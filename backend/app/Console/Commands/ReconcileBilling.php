<?php

namespace App\Console\Commands;

use App\Enums\SubscriptionStatus;
use App\Models\Subscription;
use App\Services\StripeBillingService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Daily-scheduled safety net. Stripe webhooks are the primary path for
 * keeping `subscriptions` in sync, but if the endpoint is down through
 * Stripe's whole retry window an event is lost for good. This re-pulls the
 * live state from Stripe for every subscription that has any Stripe
 * linkage and syncs it — a no-op when nothing drifted.
 */
class ReconcileBilling extends Command
{
    protected $signature = 'billing:reconcile';

    protected $description = 'Re-sync subscription state from Stripe, catching any webhooks that were missed';

    public function handle(StripeBillingService $stripe): int
    {
        $subscriptions = Subscription::query()
            ->where(fn ($query) => $query->whereNotNull('stripe_subscription_id')->orWhereNotNull('stripe_customer_id'))
            // A trial that never touched Stripe has nothing to reconcile.
            ->where('status', '!=', SubscriptionStatus::Trialing->value)
            ->get();

        $reconciled = 0;

        foreach ($subscriptions as $subscription) {
            try {
                $stripe->reconcile($subscription);
                $reconciled++;
            } catch (Throwable $e) {
                // One workspace's Stripe hiccup shouldn't abort the whole run.
                Log::warning('billing:reconcile failed for one subscription', [
                    'workspace_id' => $subscription->workspace_id,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        $this->info("Billing reconcile: {$reconciled}/{$subscriptions->count()} subscription(s) checked against Stripe.");

        return self::SUCCESS;
    }
}
