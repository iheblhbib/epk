<?php

namespace App\Services;

use App\Enums\AnalyticsEventType;
use App\Models\AnalyticsEvent;
use App\Models\Epk;
use App\Models\Workspace;
use Carbon\CarbonInterface;

/**
 * Turns raw AnalyticsEvent rows into the summary the dashboard renders.
 * Every grouped query runs against the plain query builder (`toBase()`)
 * rather than the Eloquent model builder, so partial-column result rows
 * are never run through the model's enum/array casts by accident.
 */
class AnalyticsAggregator
{
    /**
     * @return array<string, mixed>
     */
    public function summarize(Epk $epk, CarbonInterface $from, CarbonInterface $to): array
    {
        // Qualified column name (not just "created_at") because
        // topPrivateLinks below joins in private_links, which has its own
        // created_at — leaving it unqualified would be ambiguous there.
        $base = fn () => $epk->analyticsEvents()->toBase()->whereBetween('analytics_events.created_at', [$from, $to]);

        $totals = [
            'page_views' => (clone $base())->where('type', AnalyticsEventType::PageView->value)->count(),
            'unique_visitors' => (clone $base())->distinct()->count('visitor_hash'),
            'downloads' => (clone $base())->where('type', AnalyticsEventType::Download->value)->count(),
            'audio_plays' => (clone $base())->where('type', AnalyticsEventType::AudioPlay->value)->count(),
            'video_plays' => (clone $base())->where('type', AnalyticsEventType::VideoPlay->value)->count(),
        ];

        $dailyPageViews = (clone $base())
            ->where('type', AnalyticsEventType::PageView->value)
            ->selectRaw('DATE(created_at) as date, COUNT(*) as count')
            ->groupBy('date')
            ->orderBy('date')
            ->get()
            ->map(fn ($row) => ['date' => (string) $row->date, 'count' => (int) $row->count])
            ->all();

        $topReferrers = (clone $base())
            ->whereNotNull('referrer_host')
            ->selectRaw('referrer_host as referrer, COUNT(*) as count')
            ->groupBy('referrer_host')
            ->orderByDesc('count')
            ->limit(8)
            ->get()
            ->map(fn ($row) => ['referrer' => $row->referrer, 'count' => (int) $row->count])
            ->all();

        $topCountries = (clone $base())
            ->whereNotNull('country')
            ->selectRaw('country, COUNT(*) as count')
            ->groupBy('country')
            ->orderByDesc('count')
            ->limit(8)
            ->get()
            ->map(fn ($row) => ['country' => $row->country, 'count' => (int) $row->count])
            ->all();

        $devices = (clone $base())
            ->whereNotNull('device_type')
            ->selectRaw('device_type, COUNT(*) as count')
            ->groupBy('device_type')
            ->orderByDesc('count')
            ->get()
            ->map(fn ($row) => ['device_type' => $row->device_type, 'count' => (int) $row->count])
            ->all();

        $topDownloads = (clone $base())
            ->where('type', AnalyticsEventType::Download->value)
            ->whereNotNull('meta')
            ->get(['meta'])
            ->map(fn ($row) => json_decode((string) $row->meta, true)['filename'] ?? null)
            ->filter()
            ->countBy()
            ->sortDesc()
            ->take(8)
            ->map(fn ($count, $filename) => ['filename' => $filename, 'count' => $count])
            ->values()
            ->all();

        $topPrivateLinks = (clone $base())
            ->whereNotNull('private_link_id')
            ->join('private_links', 'private_links.id', '=', 'analytics_events.private_link_id')
            ->selectRaw('COALESCE(private_links.label, private_links.token) as label, COUNT(*) as count')
            ->groupBy('private_links.id', 'private_links.label', 'private_links.token')
            ->orderByDesc('count')
            ->limit(8)
            ->get()
            ->map(fn ($row) => ['label' => $row->label, 'count' => (int) $row->count])
            ->all();

        return [
            'totals' => $totals,
            'daily_page_views' => $dailyPageViews,
            'top_referrers' => $topReferrers,
            'top_countries' => $topCountries,
            'devices' => $devices,
            'top_downloads' => $topDownloads,
            'top_private_links' => $topPrivateLinks,
        ];
    }

    /**
     * Same shape as summarize(), scoped across every EPK in the workspace
     * instead of one -- powers the workspace Dashboard. Plus one addition,
     * top_epk, which summarize() has no use for (it's already scoped to a
     * single EPK).
     *
     * @return array<string, mixed>
     */
    public function summarizeForWorkspace(Workspace $workspace, CarbonInterface $from, CarbonInterface $to): array
    {
        $epks = $workspace->epks()->get(['id', 'title']);
        $epkIds = $epks->pluck('id');

        $base = fn () => AnalyticsEvent::query()->toBase()
            ->whereIn('analytics_events.epk_id', $epkIds)
            ->whereBetween('analytics_events.created_at', [$from, $to]);

        $totals = [
            'page_views' => (clone $base())->where('type', AnalyticsEventType::PageView->value)->count(),
            'unique_visitors' => (clone $base())->distinct()->count('visitor_hash'),
            'downloads' => (clone $base())->where('type', AnalyticsEventType::Download->value)->count(),
            'audio_plays' => (clone $base())->where('type', AnalyticsEventType::AudioPlay->value)->count(),
            'video_plays' => (clone $base())->where('type', AnalyticsEventType::VideoPlay->value)->count(),
        ];

        $dailyPageViews = (clone $base())
            ->where('type', AnalyticsEventType::PageView->value)
            ->selectRaw('DATE(created_at) as date, COUNT(*) as count')
            ->groupBy('date')
            ->orderBy('date')
            ->get()
            ->map(fn ($row) => ['date' => (string) $row->date, 'count' => (int) $row->count])
            ->all();

        $topReferrers = (clone $base())
            ->whereNotNull('referrer_host')
            ->selectRaw('referrer_host as referrer, COUNT(*) as count')
            ->groupBy('referrer_host')
            ->orderByDesc('count')
            ->limit(8)
            ->get()
            ->map(fn ($row) => ['referrer' => $row->referrer, 'count' => (int) $row->count])
            ->all();

        $topCountries = (clone $base())
            ->whereNotNull('country')
            ->selectRaw('country, COUNT(*) as count')
            ->groupBy('country')
            ->orderByDesc('count')
            ->limit(8)
            ->get()
            ->map(fn ($row) => ['country' => $row->country, 'count' => (int) $row->count])
            ->all();

        $devices = (clone $base())
            ->whereNotNull('device_type')
            ->selectRaw('device_type, COUNT(*) as count')
            ->groupBy('device_type')
            ->orderByDesc('count')
            ->get()
            ->map(fn ($row) => ['device_type' => $row->device_type, 'count' => (int) $row->count])
            ->all();

        // Scoped to the whole workspace (every EPK, 30-day window by
        // default), so unlike summarize()'s identical-looking block --
        // which is naturally bounded by one EPK's own download volume --
        // this can't be left to hydrate every matching row into PHP: a busy
        // workspace could have far more download events than we'd ever want
        // to json_decode() on every Dashboard load. Cap at the most recent
        // 1000 download events (well above the top-8 we report) and do the
        // filename tally over that bounded set instead.
        $topDownloads = (clone $base())
            ->where('type', AnalyticsEventType::Download->value)
            ->whereNotNull('meta')
            ->orderByDesc('analytics_events.created_at')
            ->limit(1000)
            ->get(['meta'])
            ->map(fn ($row) => json_decode((string) $row->meta, true)['filename'] ?? null)
            ->filter()
            ->countBy()
            ->sortDesc()
            ->take(8)
            ->map(fn ($count, $filename) => ['filename' => $filename, 'count' => $count])
            ->values()
            ->all();

        $topPrivateLinks = (clone $base())
            ->whereNotNull('private_link_id')
            ->join('private_links', 'private_links.id', '=', 'analytics_events.private_link_id')
            ->selectRaw('COALESCE(private_links.label, private_links.token) as label, COUNT(*) as count')
            ->groupBy('private_links.id', 'private_links.label', 'private_links.token')
            ->orderByDesc('count')
            ->limit(8)
            ->get()
            ->map(fn ($row) => ['label' => $row->label, 'count' => (int) $row->count])
            ->all();

        $topEpkRow = (clone $base())
            ->where('type', AnalyticsEventType::PageView->value)
            ->selectRaw('epk_id, COUNT(*) as views')
            ->groupBy('epk_id')
            ->orderByDesc('views')
            ->first();

        $topEpk = $topEpkRow
            ? [
                'id' => (int) $topEpkRow->epk_id,
                'title' => (string) $epks->firstWhere('id', $topEpkRow->epk_id)?->title,
                'views' => (int) $topEpkRow->views,
            ]
            : null;

        return [
            'totals' => $totals,
            'daily_page_views' => $dailyPageViews,
            'top_referrers' => $topReferrers,
            'top_countries' => $topCountries,
            'devices' => $devices,
            'top_downloads' => $topDownloads,
            'top_private_links' => $topPrivateLinks,
            'top_epk' => $topEpk,
        ];
    }
}
