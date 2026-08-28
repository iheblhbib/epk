<?php

namespace App\Policies\Concerns;

use App\Enums\WorkspaceMemberStatus;
use App\Enums\WorkspaceRole;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceMember;

trait InteractsWithWorkspaceMembership
{
    protected function membershipFor(User $user, Workspace $workspace): ?WorkspaceMember
    {
        return $workspace->members
            ->firstWhere(fn (WorkspaceMember $member) => $member->user_id === $user->id
                && $member->status === WorkspaceMemberStatus::Active);
    }

    protected function roleFor(User $user, Workspace $workspace): ?WorkspaceRole
    {
        return $this->membershipFor($user, $workspace)?->role;
    }

    protected function isMember(User $user, Workspace $workspace): bool
    {
        return $this->roleFor($user, $workspace) !== null;
    }

    protected function isEditorLevel(User $user, Workspace $workspace): bool
    {
        return in_array($this->roleFor($user, $workspace), [
            WorkspaceRole::Owner, WorkspaceRole::Admin, WorkspaceRole::Editor,
        ], true);
    }

    protected function isAdminLevel(User $user, Workspace $workspace): bool
    {
        return $this->roleFor($user, $workspace)?->isAdminLevel() ?? false;
    }
}
