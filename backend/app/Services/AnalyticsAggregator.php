<?php

namespace App\Services;

use App\Enums\AnalyticsEventType;
use App\Models\Epk;
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
}
