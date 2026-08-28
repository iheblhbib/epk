<?php

namespace App\Policies;

use App\Enums\WorkspaceMemberStatus;
use App\Enums\WorkspaceRole;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceMember;
use App\Policies\Concerns\InteractsWithWorkspaceMembership;

class WorkspacePolicy
{
    use InteractsWithWorkspaceMembership;

    public function viewAny(User $user): bool
    {
        return true;
    }

    public function view(User $user, Workspace $workspace): bool
    {
        return $this->membershipFor($user, $workspace) !== null;
    }

    public function create(User $user): bool
    {
        return $user->hasVerifiedEmail();
    }

    public function update(User $user, Workspace $workspace): bool
    {
        return $this->roleFor($user, $workspace)?->isAdminLevel() ?? false;
    }

    public function delete(User $user, Workspace $workspace): bool
    {
        return $this->roleFor($user, $workspace) === WorkspaceRole::Owner;
    }

    public function inviteMember(User $user, Workspace $workspace): bool
    {
        return $this->roleFor($user, $workspace)?->isAdminLevel() ?? false;
    }

    /**
     * Owners may change anyone's role; admins may only change editors/viewers
     * (they cannot touch owner or admin rows).
     */
    public function updateMemberRole(User $user, Workspace $workspace, WorkspaceMember $member): bool
    {
        $role = $this->roleFor($user, $workspace);

        if ($role === WorkspaceRole::Owner) {
            return true;
        }

        if ($role === WorkspaceRole::Admin) {
            return ! $member->role?->isAdminLevel();
        }

        return false;
    }

    /**
     * Same admin-level restriction as updateMemberRole, plus the last
     * remaining owner of a workspace may never be removed.
     */
    public function removeMember(User $user, Workspace $workspace, WorkspaceMember $member): bool
    {
        if ($member->role === WorkspaceRole::Owner && $this->ownerCount($workspace) <= 1) {
            return false;
        }

        $role = $this->roleFor($user, $workspace);

        if ($role === WorkspaceRole::Owner) {
            return true;
        }

        if ($role === WorkspaceRole::Admin) {
            return ! $member->role?->isAdminLevel();
        }

        return false;
    }

    public function leave(User $user, Workspace $workspace): bool
    {
        $role = $this->roleFor($user, $workspace);

        if ($role === null) {
            return false;
        }

        if ($role === WorkspaceRole::Owner && $this->ownerCount($workspace) <= 1) {
            return false;
        }

        return true;
    }

    private function ownerCount(Workspace $workspace): int
    {
        return $workspace->members
            ->where('status', WorkspaceMemberStatus::Active)
            ->where('role', WorkspaceRole::Owner)
            ->count();
    }
}
