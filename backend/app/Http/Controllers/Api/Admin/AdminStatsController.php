<?php

namespace App\Http\Controllers\Api\Admin;

use App\Enums\AnalyticsEventType;
use App\Enums\EpkStatus;
use App\Http\Controllers\Controller;
use App\Models\AnalyticsEvent;
use App\Models\Contact;
use App\Models\Epk;
use App\Models\Media;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Cache;

class AdminStatsController extends Controller
{
    public function index(): JsonResponse
    {
        // A handful of COUNT/SUM scans across the whole platform on every
        // dashboard load — fine at this app's scale today, but cheap to cap
        // regardless. A minute of staleness is a non-issue for a stats
        // dashboard, and the file cache driver (this project's default,
        // chosen for shared hosting with no Redis) makes this a plain local
        // read on every request after the first.
        $data = Cache::remember('admin.stats', 60, fn () => [
            'users' => [
                'total' => User::count(),
                'new_last_7_days' => User::where('created_at', '>=', now()->subDays(7))->count(),
                'new_last_30_days' => User::where('created_at', '>=', now()->subDays(30))->count(),
            ],
            'workspaces' => ['total' => Workspace::count()],
            'epks' => [
                'total' => Epk::count(),
                'published' => Epk::where('status', EpkStatus::Published)->count(),
                'draft' => Epk::where('status', EpkStatus::Draft)->count(),
                'archived' => Epk::where('status', EpkStatus::Archived)->count(),
            ],
            'media' => [
                'total' => Media::count(),
                'storage_bytes' => (int) Media::sum('size'),
            ],
            'contacts' => ['total' => Contact::count()],
            'analytics' => [
                'total_page_views' => AnalyticsEvent::where('type', AnalyticsEventType::PageView)->count(),
                'page_views_last_30_days' => AnalyticsEvent::where('type', AnalyticsEventType::PageView)
                    ->where('created_at', '>=', now()->subDays(30))
                    ->count(),
            ],
        ]);

        return response()->json(['data' => $data]);
    }
}
