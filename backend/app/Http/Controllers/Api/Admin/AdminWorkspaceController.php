<?php

namespace App\Http\Controllers\Api\Admin;

use App\Enums\SubscriptionPlan;
use App\Enums\SubscriptionStatus;
use App\Http\Controllers\Controller;
use App\Models\Workspace;
use App\Services\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class AdminWorkspaceController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $workspaces = Workspace::query()
            ->withCount(['members', 'epks'])
            ->with(['creator:id,name,email', 'subscription'])
            ->when($request->string('search')->trim()->isNotEmpty(), function ($query) use ($request) {
                $query->where('name', 'like', '%'.$request->string('search')->trim().'%');
            })
            ->orderByDesc('created_at')
            ->paginate(25);

        return response()->json([
            'data' => $workspaces->through(fn (Workspace $workspace) => [
                'id' => $workspace->id,
                'name' => $workspace->name,
                'slug' => $workspace->slug,
                'members_count' => $workspace->members_count,
                'epks_count' => $workspace->epks_count,
                'plan' => $workspace->subscription?->plan,
                'creator' => $workspace->creator ? ['id' => $workspace->creator->id, 'name' => $workspace->creator->name] : null,
                'created_at' => $workspace->created_at,
            ])->items(),
            'meta' => [
                'current_page' => $workspaces->currentPage(),
                'last_page' => $workspaces->lastPage(),
                'total' => $workspaces->total(),
            ],
        ]);
    }

    public function destroy(Request $request, Workspace $workspace, AuditLogger $auditLogger): JsonResponse
    {
        $auditLogger->log($request, 'workspace.deleted_by_admin', $workspace, ['name' => $workspace->name]);

        $workspace->delete();

        return response()->json(['message' => __('Workspace deleted.')]);
    }

    /**
     * Manual plan changes — the honest state of things until Stripe is
     * actually wired up (see config/plans.php). Once it is, this becomes
     * the fallback an admin uses for comps/overrides rather than the only
     * way a plan ever changes.
     *
     * Also sets status to Active and clears trial_ends_at: the access-gate
     * middleware (EnsureSubscriptionIsActive) keys off status/trial_ends_at,
     * never plan, so writing plan alone would leave a locked-out workspace
     * (an expired trial, or a canceled subscription) still locked out even
     * after an admin "comps" it to a paid plan. Active + no trial end is
     * exactly what a manual grant means: an active, non-expiring
     * subscription at that plan.
     */
    public function updateSubscription(Request $request, Workspace $workspace, AuditLogger $auditLogger): JsonResponse
    {
        $validated = $request->validate([
            'plan' => ['required', Rule::enum(SubscriptionPlan::class)],
        ]);

        // updateOrCreate, not update(): every workspace gets a subscription
        // row automatically on creation (Workspace::booted()), but that's a
        // model event — anything that creates a workspace with events
        // suppressed (a seeder using WithoutModelEvents, a raw insert)
        // silently ends up without one, and a plain update() against a
        // nonexistent row succeeds while changing nothing.
        $subscription = $workspace->subscription()->updateOrCreate([], [
            'plan' => $validated['plan'],
            'status' => SubscriptionStatus::Active,
            'trial_ends_at' => null,
        ]);
        $auditLogger->log($request, 'workspace.plan_changed_by_admin', $workspace, ['plan' => $validated['plan']]);

        return response()->json(['data' => ['id' => $workspace->id, 'plan' => $subscription->plan]]);
    }
}
