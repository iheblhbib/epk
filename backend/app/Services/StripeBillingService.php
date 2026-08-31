<?php

namespace App\Services;

use App\Enums\SubscriptionPlan;
use App\Enums\SubscriptionStatus;
use App\Models\Subscription;
use App\Models\Workspace;
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
    public function createCheckoutSession(Workspace $workspace, SubscriptionPlan $plan, string $successUrl, string $cancelUrl): string
    {
        $priceId = config("plans.{$plan->value}.stripe_price_id");

        if (! $priceId) {
            throw new RuntimeException("No Stripe price is configured for the \"{$plan->value}\" plan.");
        }

        $existingCustomerId = $workspace->subscription?->stripe_customer_id;

        $session = $this->client->checkout->sessions->create([
            'mode' => 'subscription',
            'customer' => $existingCustomerId,
            'customer_email' => $existingCustomerId ? null : $workspace->creator?->email,
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

        Subscription::updateOrCreate(
            ['workspace_id' => $workspaceId],
            [
                'plan' => $this->planFromPriceId($priceId),
                'status' => $this->mapStatus($stripeSubscription->status),
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
            ]
        );
    }

    /**
     * The subscription no longer exists on Stripe's side at all (as
     * opposed to merely being past-due) — drop the workspace back to Free
     * rather than leave it reading a paid plan's limits forever.
     */
    public function handleSubscriptionDeleted(StripeSubscription $stripeSubscription): void
    {
        $workspaceId = $stripeSubscription->metadata['workspace_id'] ?? null;

        if (! $workspaceId) {
            return;
        }

        Subscription::where('workspace_id', $workspaceId)->update([
            'plan' => SubscriptionPlan::Free,
            'status' => SubscriptionStatus::Canceled,
            'stripe_subscription_id' => null,
            'canceled_at' => now(),
        ]);
    }

    private function planFromPriceId(?string $priceId): SubscriptionPlan
    {
        if ($priceId !== null) {
            foreach (SubscriptionPlan::cases() as $plan) {
                if (config("plans.{$plan->value}.stripe_price_id") === $priceId) {
                    return $plan;
                }
            }
        }

        return SubscriptionPlan::Free;
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
