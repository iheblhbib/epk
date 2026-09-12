<?php

namespace App\Services;

use App\Enums\SubscriptionPlan;
use App\Enums\SubscriptionStatus;
use App\Models\Subscription;
use App\Models\Workspace;

/**
 * Billing/revenue numbers for the admin dashboard, computed entirely from
 * local `subscriptions` rows -- no live Stripe calls (this runs inside the
 * existing 60s-cached admin stats blob, on a page every admin session
 * visits, so a per-request Stripe round trip would be both slow and an
 * unnecessary rate-limit risk).
 */
class AdminBillingStats
{
    /**
     * @return array{mrr: float, active_by_plan: array<string, int>, by_status: array<string, int>, trial_conversion_rate: float, canceled_last_30_days: int}
     */
    public function summarize(): array
    {
        $activeSubscriptions = Subscription::where('status', SubscriptionStatus::Active)->get(['plan', 'billing_interval']);

        $mrr = $activeSubscriptions->sum(function (Subscription $subscription) {
            $prices = config("plans.{$subscription->plan->value}");

            return $subscription->billing_interval === 'yearly'
                ? $prices['price_yearly_effective_monthly']
                : $prices['price_monthly'];
        });

        $activeByPlan = collect(SubscriptionPlan::cases())->mapWithKeys(
            fn (SubscriptionPlan $plan) => [$plan->value => $activeSubscriptions->where('plan', $plan)->count()]
        )->all();

        $byStatus = collect(SubscriptionStatus::cases())->mapWithKeys(
            fn (SubscriptionStatus $status) => [$status->value => Subscription::where('status', $status)->count()]
        )->all();

        $recentWorkspaces = Workspace::where('created_at', '>=', now()->subDays(30))->count();
        $recentConverted = Workspace::where('created_at', '>=', now()->subDays(30))
            ->whereHas('subscription', fn ($query) => $query->whereNotNull('stripe_customer_id'))
            ->count();

        $canceledLast30Days = Subscription::where('status', SubscriptionStatus::Canceled)
            ->where('canceled_at', '>=', now()->subDays(30))
            ->count();

        return [
            'mrr' => round($mrr, 2),
            'active_by_plan' => $activeByPlan,
            'by_status' => $byStatus,
            'trial_conversion_rate' => $recentWorkspaces > 0 ? round(($recentConverted / $recentWorkspaces) * 100, 1) : 0.0,
            'canceled_last_30_days' => $canceledLast30Days,
        ];
    }
}
