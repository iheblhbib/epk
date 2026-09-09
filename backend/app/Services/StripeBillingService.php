<?php

namespace App\Services;

use App\Enums\SubscriptionPlan;
use App\Enums\SubscriptionStatus;
use App\Models\Subscription;
use App\Models\Workspace;
use Illuminate\Support\Facades\Log;
use RuntimeException;
use Stripe\Event;
use Stripe\Exception\SignatureVerificationException;
use Stripe\StripeClient;
use Stripe\Subscription as StripeSubscription;
use Stripe\Webhook;

/**
 * Thin wrapper around the raw Stripe SDK rather than Laravel Cashier —
 * Cashier's Billable trait and its own `subscriptions` table assume a
 * single billable model (usually User) with Cashier's own schema, which
 * would collide with the workspace-scoped `subscriptions` table and
 * SubscriptionPlan/SubscriptionStatus enums this app already had in place
 * before Stripe was wired up (see config/plans.php). This keeps that
 * existing shape as the source of truth and only talks to Stripe for the
 * checkout/portal/webhook mechanics.
 */
class StripeBillingService
{
    private StripeClient $client;

    public function __construct()
    {
        $this->client = new StripeClient(config('services.stripe.secret'));
    }

    /**
     * @return string The Stripe-hosted Checkout URL to redirect the browser to.
     */
    public function createCheckoutSession(Workspace $workspace, SubscriptionPlan $plan, string $interval, string $successUrl, string $cancelUrl): string
    {
        $priceId = config("plans.{$plan->value}.stripe_price_id_{$interval}");

        if (! $priceId) {
            throw new RuntimeException("No Stripe {$interval} price is configured for the \"{$plan->value}\" plan.");
        }

        $existingCustomerId = $workspace->subscription?->stripe_customer_id;

        // Stripe's Checkout Session API rejects a request that specifies
        // both `customer` and `customer_email` -- not just both non-empty,
        // but both *present* at all, even with one set to null/omitted via
        // a falsy PHP value. Only one of the two keys can appear.
        $customerParam = $existingCustomerId
            ? ['customer' => $existingCustomerId]
            : ['customer_email' => $workspace->creator?->email];

        $session = $this->client->checkout->sessions->create([
            'mode' => 'subscription',
            ...$customerParam,
            // Belt-and-suspenders workspace lookup on the webhook side: this
            // lands on the Checkout Session itself, while subscription_data
            // below copies the same metadata onto the Subscription object
            // Stripe creates — every later `customer.subscription.*` event
            // carries it too, not just the initial checkout.session.completed.
            'client_reference_id' => (string) $workspace->id,
            'line_items' => [['price' => $priceId, 'quantity' => 1]],
            'success_url' => $successUrl,
            'cancel_url' => $cancelUrl,
            'subscription_data' => [
                'metadata' => ['workspace_id' => $workspace->id],
            ],
        ]);

        return $session->url;
    }

    /**
     * @return string The Stripe-hosted Billing Portal URL — lets the
     *                workspace owner change plans, update their card, or cancel
     *                entirely without any of that needing its own UI in this app.
     */
    public function createPortalSession(Workspace $workspace, string $returnUrl): string
    {
        $customerId = $workspace->subscription?->stripe_customer_id;

        if (! $customerId) {
            throw new RuntimeException('This workspace has no billing account yet — subscribe to a paid plan first.');
        }

        $session = $this->client->billingPortal->sessions->create([
            'customer' => $customerId,
            'return_url' => $returnUrl,
        ]);

        return $session->url;
    }

    /**
     * Verifies the request actually came from Stripe (not a forged POST to
     * a guessed public URL) before any event data is trusted.
     *
     * @throws SignatureVerificationException
     */
    public function constructEvent(string $payload, string $signature): Event
    {
        return Webhook::constructEvent($payload, $signature, (string) config('services.stripe.webhook_secret'));
    }

    public function syncFromStripeSubscription(StripeSubscription $stripeSubscription): void
    {
        $workspaceId = $stripeSubscription->metadata['workspace_id'] ?? null;

        if (! $workspaceId || ! Workspace::whereKey($workspaceId)->exists()) {
            return;
        }

        $firstItem = $stripeSubscription->items->data[0] ?? null;
        $priceId = $firstItem?->price->id ?? null;
        // Stripe API 2025-03-31+ moved current_period_end off the
        // subscription root onto each line item (a subscription can mix
        // items with different billing cycles) — this SDK is pinned to
        // 2026-08-26.dahlia, well past that change.
        $periodEnd = $firstItem?->current_period_end ?? null;

        [$plan, $interval] = $this->planAndIntervalFromPriceId($priceId, (int) $workspaceId);

        $attributes = [
            'plan' => $plan,
            'billing_interval' => $interval,
            'stripe_customer_id' => is_string($stripeSubscription->customer)
                ? $stripeSubscription->customer
                : $stripeSubscription->customer->id,
            'stripe_subscription_id' => $stripeSubscription->id,
            'current_period_ends_at' => $periodEnd !== null
                ? now()->createFromTimestamp($periodEnd)
                : null,
            'canceled_at' => $stripeSubscription->canceled_at !== null
                ? now()->createFromTimestamp($stripeSubscription->canceled_at)
                : null,
        ];

        // 'incomplete' is a transient, non-final Stripe state (a
        // subscription mid-checkout, awaiting 3DS/SCA confirmation) — not
        // the same thing as a failed payment. Leaving the local `status`
        // untouched here avoids briefly showing a user who just paid as
        // locked-out-as-if-they-failed-to-pay before the follow-up webhook
        // resolves it to 'active'.
        if ($stripeSubscription->status !== 'incomplete') {
            $attributes['status'] = $this->mapStatus($stripeSubscription->status);
        }

        Subscription::updateOrCreate(['workspace_id' => $workspaceId], $attributes);
    }

    /**
     * The subscription no longer exists on Stripe's side at all (as
     * opposed to merely being past-due). There's no Free plan to fall back
     * to any more — this just marks the subscription canceled, which the
     * access-gate middleware (EnsureSubscriptionIsActive) reads as a hard
     * lockout, same as an expired trial. `plan` is deliberately left
     * untouched: it no longer means anything once status is Canceled.
     */
    public function handleSubscriptionDeleted(StripeSubscription $stripeSubscription): void
    {
        $workspaceId = $stripeSubscription->metadata['workspace_id'] ?? null;

        if (! $workspaceId) {
            return;
        }

        Subscription::where('workspace_id', $workspaceId)->update([
            'status' => SubscriptionStatus::Canceled,
            'stripe_subscription_id' => null,
            'billing_interval' => null,
            'canceled_at' => now(),
        ]);
    }

    /**
     * @return array{0: SubscriptionPlan, 1: string|null}
     */
    private function planAndIntervalFromPriceId(?string $priceId, int $workspaceId): array
    {
        if ($priceId !== null) {
            foreach (SubscriptionPlan::cases() as $plan) {
                foreach (['monthly', 'yearly'] as $interval) {
                    if (config("plans.{$plan->value}.stripe_price_id_{$interval}") === $priceId) {
                        return [$plan, $interval];
                    }
                }
            }
        }

        // No configured price id matches the one on the incoming webhook —
        // most likely a misconfigured/rotated Stripe price id. Falling back
        // to a hardcoded plan here would silently downgrade (or upgrade) a
        // subscriber with no record of why; keep whatever plan the
        // workspace already has instead, and log so the mismatch gets
        // noticed and fixed.
        Log::warning("Stripe webhook: no configured plan/interval matches price id {$priceId}", [
            'workspace_id' => $workspaceId,
        ]);

        // ->first()?->plan (not ->value('plan')): value() reads the raw
        // column via the query builder, bypassing Eloquent's enum cast.
        $existingPlan = Subscription::where('workspace_id', $workspaceId)->first()?->plan;

        return [$existingPlan ?? SubscriptionPlan::Starter, null];
    }

    private function mapStatus(string $stripeStatus): SubscriptionStatus
    {
        return match ($stripeStatus) {
            'active', 'trialing' => SubscriptionStatus::Active,
            'past_due', 'unpaid', 'incomplete' => SubscriptionStatus::PastDue,
            'canceled', 'incomplete_expired' => SubscriptionStatus::Canceled,
            default => SubscriptionStatus::Active,
        };
    }
}
