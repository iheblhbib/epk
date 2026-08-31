<?php

namespace App\Http\Controllers\Api;

use App\Enums\SubscriptionPlan;
use App\Http\Controllers\Controller;
use App\Models\Workspace;
use App\Services\PlanLimits;
use App\Services\StripeBillingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use RuntimeException;

class BillingController extends Controller
{
    public function show(Workspace $workspace, PlanLimits $planLimits): JsonResponse
    {
        $this->authorize('view', $workspace);

        return response()->json([
            'data' => [
                'plan' => $planLimits->plan($workspace),
                'subscription_status' => $workspace->subscription?->status,
                'current_period_ends_at' => $workspace->subscription?->current_period_ends_at,
                'has_stripe_customer' => $workspace->subscription?->stripe_customer_id !== null,
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

    /**
     * Starts a Stripe Checkout session to subscribe (or switch) this
     * workspace to a paid plan. Admin-level only — same ability as any
     * other workspace-settings change, matching WorkspacePolicy::update.
     */
    public function checkout(Request $request, Workspace $workspace, StripeBillingService $stripe): JsonResponse
    {
        $this->authorize('update', $workspace);

        $validated = $request->validate([
            'plan' => ['required', Rule::in([SubscriptionPlan::Pro->value, SubscriptionPlan::Business->value])],
        ]);

        $frontendUrl = rtrim((string) config('app.frontend_url'), '/');

        try {
            $url = $stripe->createCheckoutSession(
                $workspace,
                SubscriptionPlan::from($validated['plan']),
                successUrl: "{$frontendUrl}/billing?checkout=success",
                cancelUrl: "{$frontendUrl}/billing?checkout=canceled",
            );
        } catch (RuntimeException $e) {
            throw ValidationException::withMessages(['plan' => $e->getMessage()]);
        }

        return response()->json(['data' => ['url' => $url]]);
    }

    /**
     * Opens Stripe's own hosted Billing Portal — card updates, invoice
     * history, cancellation, and plan switching all happen there instead
     * of this app needing to build any of it.
     */
    public function portal(Workspace $workspace, StripeBillingService $stripe): JsonResponse
    {
        $this->authorize('update', $workspace);

        $frontendUrl = rtrim((string) config('app.frontend_url'), '/');

        try {
            $url = $stripe->createPortalSession($workspace, returnUrl: "{$frontendUrl}/billing");
        } catch (RuntimeException $e) {
            throw ValidationException::withMessages(['workspace' => $e->getMessage()]);
        }

        return response()->json(['data' => ['url' => $url]]);
    }
}
