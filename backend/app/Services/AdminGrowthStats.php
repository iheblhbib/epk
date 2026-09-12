<?php

namespace App\Services;

use App\Models\User;
use App\Models\Workspace;
use Carbon\CarbonImmutable;

/**
 * Daily new-user / new-workspace counts for the admin dashboard's growth
 * chart. Fixed 30-day window, matching this app's other dashboard defaults
 * (Analytics page, workspace Dashboard).
 */
class AdminGrowthStats
{
    /**
     * @return list<array{date: string, new_users: int, new_workspaces: int}>
     */
    public function dailyGrowth(): array
    {
        $from = CarbonImmutable::now()->subDays(29)->startOfDay();

        $userCounts = User::where('created_at', '>=', $from)
            ->selectRaw('DATE(created_at) as date, COUNT(*) as count')
            ->groupBy('date')
            ->pluck('count', 'date');

        $workspaceCounts = Workspace::where('created_at', '>=', $from)
            ->selectRaw('DATE(created_at) as date, COUNT(*) as count')
            ->groupBy('date')
            ->pluck('count', 'date');

        $days = [];
        for ($cursor = $from; $cursor->lte(CarbonImmutable::now()); $cursor = $cursor->addDay()) {
            $key = $cursor->toDateString();
            $days[] = [
                'date' => $key,
                'new_users' => (int) ($userCounts[$key] ?? 0),
                'new_workspaces' => (int) ($workspaceCounts[$key] ?? 0),
            ];
        }

        return $days;
    }
}
