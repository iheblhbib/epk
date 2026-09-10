<?php

namespace App\Services;

use App\Enums\SubscriptionPlan;
use App\Enums\SubscriptionStatus;
use App\Models\Workspace;
use Carbon\CarbonInterface;

/**
 * Resolves a workspace's effective plan limits/features from config/plans.php.
 * Every workspace has a subscription row from the moment it's created (see
 * Workspace::booted()), so this never has to special-case "no subscription".
 */
class PlanLimits
{
    public function plan(Workspace $workspace): SubscriptionPlan
    {
        return $workspace->subscription?->plan ?? SubscriptionPlan::Starter;
    }

    /**
     * @return array<string, mixed>
     */
    public function limits(Workspace $workspace): array
    {
        return config('plans.'.$this->plan($workspace)->value);
    }

    /**
     * Null means unlimited.
     */
    public function maxEpks(Workspace $workspace): ?int
    {
        return $this->limits($workspace)['max_epks'];
    }

    public function maxStorageBytes(Workspace $workspace): ?int
    {
        return $this->limits($workspace)['max_storage_bytes'];
    }

    public function maxTeamMembers(Workspace $workspace): ?int
    {
        return $this->limits($workspace)['max_team_members'];
    }

    public function maxArtists(Workspace $workspace): ?int
    {
        return $this->limits($workspace)['max_artists'];
    }

    public function canUseCustomThemes(Workspace $workspace): bool
    {
        return (bool) $this->limits($workspace)['custom_themes'];
    }

    public function canUsePrivateLinks(Workspace $workspace): bool
    {
        return (bool) $this->limits($workspace)['private_links'];
    }

    public function canUseCustomDomains(Workspace $workspace): bool
    {
        return (bool) $this->limits($workspace)['custom_domains'];
    }

    public function canCreateEpk(Workspace $workspace): bool
    {
        $max = $this->maxEpks($workspace);

        return $max === null || $workspace->epks()->count() < $max;
    }

    public function canAddTeamMember(Workspace $workspace): bool
    {
        $max = $this->maxTeamMembers($workspace);

        return $max === null || $workspace->members()->count() < $max;
    }

    public function canCreateArtist(Workspace $workspace): bool
    {
        $max = $this->maxArtists($workspace);

        return $max === null || $workspace->artists()->count() < $max;
    }

    /**
     * Same "active or still-trialing" check EnsureSubscriptionIsActive
     * enforces for every authenticated, workspace-scoped route -- also used
     * by the private-link gate (PrivatePageController::findActiveLink()),
     * which resolves its own workspace manually since a `/private/{token}`
     * request isn't authenticated and doesn't route-bind a Workspace.
     */
    public function hasActiveAccess(Workspace $workspace): bool
    {
        $subscription = $workspace->subscription;

        return match ($subscription?->status) {
            SubscriptionStatus::Active => true,
            // Grace: a failed renewal charge that Stripe is still retrying
            // keeps full access. Once Stripe gives up it moves the
            // subscription to Unpaid or Canceled, both of which lock.
            SubscriptionStatus::PastDue => true,
            SubscriptionStatus::Trialing => (bool) $subscription->trial_ends_at?->isFuture(),
            default => false,
        };
    }

    /**
     * When this workspace loses access if nothing changes — the trial's end
     * for a running trial, null for an active or grace-period (past_due)
     * subscription, and "now" (already lost) for anything locked. Surfaced
     * on the billing endpoint so the frontend can show one consistent
     * "access ends / ended on" line.
     */
    public function accessEndsAt(Workspace $workspace): ?CarbonInterface
    {
        $subscription = $workspace->subscription;

        return match ($subscription?->status) {
            SubscriptionStatus::Trialing => $subscription->trial_ends_at,
            SubscriptionStatus::Canceled, SubscriptionStatus::Unpaid => $subscription->canceled_at ?? now(),
            default => null,
        };
    }

    public function remainingStorageBytes(Workspace $workspace): ?int
    {
        $max = $this->maxStorageBytes($workspace);

        if ($max === null) {
            return null;
        }

        return max(0, $max - (int) $workspace->media()->sum('size'));
    }

    public function hasStorageFor(Workspace $workspace, int $additionalBytes): bool
    {
        $remaining = $this->remainingStorageBytes($workspace);

        return $remaining === null || $additionalBytes <= $remaining;
    }
}
