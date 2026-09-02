<?php

namespace App\Http\Middleware;

use App\Enums\SubscriptionStatus;
use App\Models\Workspace;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Hard lockout for a workspace whose 14-day trial has run out (or whose
 * paid subscription was canceled) with nothing active to replace it --
 * every workspace-scoped route is blocked except the billing routes
 * themselves (excluded via Route::withoutMiddleware() in routes/api.php),
 * so a locked-out workspace can still always reach the one place that lets
 * it pay to unlock again.
 *
 * Resolves "the workspace" generically from whatever's route-bound on this
 * request -- a Workspace directly, or any other model with its own
 * workspace() relation (Epk, Media, Contact, Artist, WorkspaceMember all
 * have one) -- rather than hardcoding a list of route parameter names, so
 * a new workspace-scoped route never needs this middleware taught about
 * its specific shape.
 */
class EnsureSubscriptionIsActive
{
    public function handle(Request $request, Closure $next): Response
    {
        $workspace = $this->resolveWorkspace($request);

        if ($workspace === null) {
            return $next($request);
        }

        $subscription = $workspace->subscription;

        $hasAccess = $subscription?->status === SubscriptionStatus::Active
            || ($subscription?->status === SubscriptionStatus::Trialing && $subscription->trial_ends_at?->isFuture());

        if (! $hasAccess) {
            abort(402, __('Your trial has ended. Choose a plan to keep using this workspace.'));
        }

        return $next($request);
    }

    private function resolveWorkspace(Request $request): ?Workspace
    {
        foreach ($request->route()?->parameters() ?? [] as $param) {
            if ($param instanceof Workspace) {
                return $param;
            }

            if (is_object($param) && method_exists($param, 'workspace')) {
                return $param->workspace;
            }
        }

        // Index/list-style routes (e.g. GET /epks?workspace_id=1) resolve
        // the workspace from a query param instead of a bound route model.
        if ($request->filled('workspace_id')) {
            return Workspace::find($request->input('workspace_id'));
        }

        return null;
    }
}
