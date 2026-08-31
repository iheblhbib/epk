<?php

namespace App\Services;

use App\Enums\SubscriptionPlan;
use App\Models\Workspace;

/**
 * Resolves a workspace's effective plan limits/features from config/plans.php.
 * Every workspace has a subscription row from the moment it's created (see
 * Workspace::booted()), so this never has to special-case "no subscription".
 */
class PlanLimits
{
    public function plan(Workspace $workspace): SubscriptionPlan
    {
        return $workspace->subscription?->plan ?? SubscriptionPlan::Free;
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
