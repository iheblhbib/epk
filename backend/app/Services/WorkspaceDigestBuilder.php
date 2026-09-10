<?php

namespace App\Services;

use App\Enums\AnalyticsEventType;
use App\Enums\EpkStatus;
use App\Models\AnalyticsEvent;
use App\Models\Workspace;
use Carbon\CarbonInterface;

/**
 * Builds the weekly activity digest for a whole workspace (across all its
 * published EPKs), for the `digest:weekly` command. Returns null when the
 * window had no page views at all — the command uses that to skip a
 * "0 views this week" email.
 */
class WorkspaceDigestBuilder
{
    /**
     * @return array{page_views: int, unique_visitors: int, downloads: int, previous_page_views: int, top_epk: array{title: string, views: int}|null, top_referrer: string|null}|null
     */
    public function build(Workspace $workspace, CarbonInterface $from, CarbonInterface $to): ?array
    {
        $epks = $workspace->epks()
            ->where('status', EpkStatus::Published->value)
            ->get(['id', 'title']);

        if ($epks->isEmpty()) {
            return null;
        }

        $epkIds = $epks->pluck('id');
        $window = fn () => AnalyticsEvent::query()->toBase()->whereIn('epk_id', $epkIds);

        $pageViews = (clone $window())
            ->where('type', AnalyticsEventType::PageView->value)
            ->whereBetween('created_at', [$from, $to])
            ->count();

        if ($pageViews === 0) {
            return null;
        }

        // The equally-long window immediately before this one, for the
        // week-over-week comparison.
        $windowLength = $from->diffInSeconds($to);
        $priorFrom = $from->copy()->subSeconds($windowLength);

        $topEpkRow = (clone $window())
            ->where('type', AnalyticsEventType::PageView->value)
            ->whereBetween('created_at', [$from, $to])
            ->selectRaw('epk_id, COUNT(*) as views')
            ->groupBy('epk_id')
            ->orderByDesc('views')
            ->first();

        $topReferrer = (clone $window())
            ->whereBetween('created_at', [$from, $to])
            ->whereNotNull('referrer_host')
            ->selectRaw('referrer_host, COUNT(*) as count')
            ->groupBy('referrer_host')
            ->orderByDesc('count')
            ->value('referrer_host');

        return [
            'page_views' => $pageViews,
            'unique_visitors' => (clone $window())
                ->whereBetween('created_at', [$from, $to])
                ->distinct()
                ->count('visitor_hash'),
            'downloads' => (clone $window())
                ->where('type', AnalyticsEventType::Download->value)
                ->whereBetween('created_at', [$from, $to])
                ->count(),
            'previous_page_views' => (clone $window())
                ->where('type', AnalyticsEventType::PageView->value)
                ->whereBetween('created_at', [$priorFrom, $from])
                ->count(),
            'top_epk' => $topEpkRow
                ? ['title' => (string) $epks->firstWhere('id', $topEpkRow->epk_id)?->title, 'views' => (int) $topEpkRow->views]
                : null,
            'top_referrer' => $topReferrer,
        ];
    }
}
