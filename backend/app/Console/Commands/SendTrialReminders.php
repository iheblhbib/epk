<?php

namespace App\Console\Commands;

use App\Enums\SubscriptionStatus;
use App\Models\Subscription;
use App\Notifications\TrialEndedNotification;
use App\Notifications\TrialEndingNotification;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Notification;

/**
 * Daily-scheduled (see routes/console.php). Walks every still-trialing
 * subscription and emails its owners/admins the next reminder they haven't
 * had yet: 3 days out, then 1 day out, then a "trial ended" notice once it
 * lapses.
 *
 * `trial_reminder_stage` on the subscription row (null -> '3' -> '1' ->
 * 'ended') is advanced monotonically, so a re-run the same day, or a run
 * after the cron missed a day, never re-sends an earlier reminder — it
 * just jumps to whichever stage is now due.
 */
class SendTrialReminders extends Command
{
    protected $signature = 'billing:trial-reminders';

    protected $description = 'Email trial-ending and trial-ended reminders to workspace owners and admins';

    public function handle(): int
    {
        $subscriptions = Subscription::query()
            ->where('status', SubscriptionStatus::Trialing)
            ->whereNotNull('trial_ends_at')
            ->where(fn ($query) => $query->whereNull('trial_reminder_stage')->orWhere('trial_reminder_stage', '!=', 'ended'))
            ->with('workspace')
            ->get();

        $sent = 0;

        foreach ($subscriptions as $subscription) {
            $workspace = $subscription->workspace;

            if ($workspace === null) {
                continue;
            }

            $target = $this->targetStage($subscription->trial_ends_at);

            if ($target === null || $this->rank($target) <= $this->rank($subscription->trial_reminder_stage)) {
                continue;
            }

            $recipients = $workspace->adminUsers();

            if ($recipients->isNotEmpty()) {
                Notification::send($recipients, $target === 'ended'
                    ? new TrialEndedNotification($workspace)
                    : new TrialEndingNotification((int) $target, $workspace));
                $sent += $recipients->count();
            }

            // Advance the stage even when there was nobody to notify — a
            // workspace with no active owner/admin shouldn't be retried
            // every day forever.
            $subscription->update(['trial_reminder_stage' => $target]);
        }

        $this->info("Trial reminders processed: {$subscriptions->count()} trialing subscription(s), {$sent} email(s) sent.");

        return self::SUCCESS;
    }

    private function targetStage(Carbon $trialEndsAt): ?string
    {
        if ($trialEndsAt->isPast()) {
            return 'ended';
        }

        if ($trialEndsAt->lessThanOrEqualTo(now()->addDay())) {
            return '1';
        }

        if ($trialEndsAt->lessThanOrEqualTo(now()->addDays(3))) {
            return '3';
        }

        return null;
    }

    private function rank(?string $stage): int
    {
        return match ($stage) {
            '3' => 1,
            '1' => 2,
            'ended' => 3,
            default => 0,
        };
    }
}
