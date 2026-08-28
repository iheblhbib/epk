<?php

namespace App\Http\Controllers\Api;

use App\Enums\SubscriptionPlan;
use App\Http\Controllers\Controller;
use App\Models\Workspace;
use App\Services\PlanLimits;
use Illuminate\Http\JsonResponse;

class BillingController extends Controller
{
    public function show(Workspace $workspace, PlanLimits $planLimits): JsonResponse
    {
        $this->authorize('view', $workspace);

        return response()->json([
            'data' => [
                'plan' => $planLimits->plan($workspace),
                'usage' => [
                    'epks' => ['used' => $workspace->epks()->count(), 'limit' => $planLimits->maxEpks($workspace)],
                    'team_members' => ['used' => $workspace->members()->count(), 'limit' => $planLimits->maxTeamMembers($workspace)],
                    'storage_bytes' => [
                        'used' => (int) $workspace->media()->sum('size'),
                        'limit' => $planLimits->maxStorageBytes($workspace),
                    ],
                ],
                'plans' => collect(SubscriptionPlan::cases())->mapWithKeys(
                    fn (SubscriptionPlan $plan) => [$plan->value => ['plan' => $plan, ...config("plans.{$plan->value}")]]
                ),
            ],
        ]);
    }
}
