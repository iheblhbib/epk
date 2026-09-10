<?php

namespace App\Console\Commands;

use App\Enums\AnalyticsEventType;
use App\Enums\EpkStatus;
use App\Models\Epk;
use App\Notifications\ViewMilestoneNotification;
use App\Services\PlanLimits;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Notification;

/**
 * Daily-scheduled. When a published EPK's all-time page-view count crosses
 * a threshold it hasn't crossed before, emails its owners/admins the good
 * news. Only the highest newly-crossed threshold is announced (a big jump
 * gets one email with the impressive number), and `epks.last_view_milestone`
 * records it so it's never announced twice.
 */
class SendViewMilestones extends Command
{
    protected $signature = 'epks:view-milestones';

    protected $description = 'Announce page-view milestones for published EPKs to their owners/admins';

    /** @var list<int> */
    private const MILESTONES = [100, 500, 1000, 5000, 10000, 50000, 100000, 500000, 1000000];

    public function handle(PlanLimits $planLimits): int
    {
        $epks = Epk::query()
            ->where('status', EpkStatus::Published->value)
            ->with('workspace.subscription')
            ->get();

        $sent = 0;

        foreach ($epks as $epk) {
            if (! $epk->workspace || ! $planLimits->hasActiveAccess($epk->workspace)) {
                continue;
            }

            $views = $epk->analyticsEvents()->where('type', AnalyticsEventType::PageView->value)->count();

            $crossed = collect(self::MILESTONES)
                ->filter(fn (int $milestone) => $milestone <= $views && $milestone > $epk->last_view_milestone)
                ->max();

            if ($crossed === null) {
                continue;
            }

            $recipients = $epk->workspace->adminUsers();

            if ($recipients->isNotEmpty()) {
                Notification::send($recipients, new ViewMilestoneNotification($epk, $crossed));
                $sent += $recipients->count();
            }

            $epk->update(['last_view_milestone' => $crossed]);
        }

        $this->info("View milestones: {$sent} notification(s) sent.");

        return self::SUCCESS;
    }
}
