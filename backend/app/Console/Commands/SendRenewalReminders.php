<?php

namespace App\Console\Commands;

use App\Enums\SubscriptionStatus;
use App\Models\Subscription;
use App\Notifications\AnnualRenewalReminderNotification;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Notification;

/**
 * Daily-scheduled. Emails a workspace's owners/admins roughly a week
 * before an *annual* subscription renews — a yearly charge is easy to
 * forget, and a surprise one is a support ticket (or a chargeback).
 * `renewal_reminded_at` (cleared on each renewal by
 * StripeBillingService::syncFromStripeSubscription) keeps it to one
 * reminder per period.
 */
class SendRenewalReminders extends Command
{
    protected $signature = 'billing:renewal-reminders';

    protected $description = 'Remind annual subscribers a week before their renewal charge';

    public function handle(): int
    {
        $subscriptions = Subscription::query()
            ->where('status', SubscriptionStatus::Active->value)
            ->where('billing_interval', 'yearly')
            ->whereNull('cancels_at')
            ->whereNull('renewal_reminded_at')
            ->whereNotNull('current_period_ends_at')
            ->whereBetween('current_period_ends_at', [now(), now()->addDays(7)])
            ->with('workspace')
            ->get();

        $sent = 0;

        foreach ($subscriptions as $subscription) {
            if ($subscription->workspace === null) {
                continue;
            }

            $recipients = $subscription->workspace->adminUsers();

            if ($recipients->isNotEmpty()) {
                Notification::send($recipients, new AnnualRenewalReminderNotification(
                    $subscription->workspace,
                    $subscription->current_period_ends_at,
                    $subscription->plan->label(),
                ));
                $sent += $recipients->count();
            }

            $subscription->update(['renewal_reminded_at' => now()]);
        }

        $this->info("Renewal reminders: {$subscriptions->count()} annual subscription(s) due, {$sent} email(s) sent.");

        return self::SUCCESS;
    }
}
