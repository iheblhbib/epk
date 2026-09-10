<?php

namespace App\Console\Commands;

use App\Enums\EpkStatus;
use App\Models\Epk;
use App\Notifications\DraftEpkReminderNotification;
use App\Services\PlanLimits;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Notification;

/**
 * Daily-scheduled. Emails a workspace's owners/admins once about an EPK
 * that's been a draft for a week and has never been published — a gentle
 * activation nudge. `epks.draft_nudged_at` guarantees one nudge per EPK,
 * ever.
 */
class SendDraftEpkReminders extends Command
{
    protected $signature = 'epks:draft-nudge';

    protected $description = 'Nudge owners/admins about EPKs that have been drafts for a week';

    public function handle(PlanLimits $planLimits): int
    {
        $epks = Epk::query()
            ->where('status', EpkStatus::Draft->value)
            ->whereNull('published_at')
            ->whereNull('draft_nudged_at')
            ->where('created_at', '<=', now()->subDays(7))
            ->with('workspace.subscription')
            ->get();

        $sent = 0;

        foreach ($epks as $epk) {
            if (! $epk->workspace || ! $planLimits->hasActiveAccess($epk->workspace)) {
                continue;
            }

            $recipients = $epk->workspace->adminUsers();

            if ($recipients->isNotEmpty()) {
                Notification::send($recipients, new DraftEpkReminderNotification($epk));
                $sent += $recipients->count();
            }

            $epk->update(['draft_nudged_at' => now()]);
        }

        $this->info("Draft nudges: {$epks->count()} eligible EPK(s), {$sent} notification(s) sent.");

        return self::SUCCESS;
    }
}
