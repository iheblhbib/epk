<?php

namespace App\Console\Commands;

use App\Models\Workspace;
use App\Notifications\WeeklyDigestNotification;
use App\Services\PlanLimits;
use App\Services\WorkspaceDigestBuilder;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Notification;

/**
 * Weekly-scheduled (Mondays). One activity digest per workspace that had
 * page views in the last 7 days, to its owners/admins. Locked workspaces
 * (expired trial / canceled) and silent weeks are skipped — a digest is a
 * re-engagement hook, not something to send into a void.
 */
class SendWeeklyDigests extends Command
{
    protected $signature = 'digest:weekly';

    protected $description = 'Email each active workspace its weekly activity digest';

    public function handle(PlanLimits $planLimits, WorkspaceDigestBuilder $builder): int
    {
        $to = now();
        $from = $to->copy()->subDays(7);
        $sent = 0;

        Workspace::query()->with('subscription')->chunkById(100, function ($workspaces) use ($planLimits, $builder, $from, $to, &$sent) {
            foreach ($workspaces as $workspace) {
                if (! $planLimits->hasActiveAccess($workspace)) {
                    continue;
                }

                $digest = $builder->build($workspace, $from, $to);

                if ($digest === null) {
                    continue;
                }

                $recipients = $workspace->adminUsers();

                if ($recipients->isNotEmpty()) {
                    Notification::send($recipients, new WeeklyDigestNotification($workspace, $digest));
                    $sent += $recipients->count();
                }
            }
        });

        $this->info("Weekly digests: {$sent} notification(s) sent.");

        return self::SUCCESS;
    }
}
