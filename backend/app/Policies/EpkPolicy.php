<?php

namespace App\Policies;

use App\Models\Epk;
use App\Models\User;
use App\Models\Workspace;
use App\Policies\Concerns\InteractsWithWorkspaceMembership;

class EpkPolicy
{
    use InteractsWithWorkspaceMembership;

    public function viewAny(User $user, Workspace $workspace): bool
    {
        return $this->isMember($user, $workspace);
    }

    public function view(User $user, Epk $epk): bool
    {
        return $this->isMember($user, $epk->workspace);
    }

    public function create(User $user, Workspace $workspace): bool
    {
        return $this->isEditorLevel($user, $workspace);
    }

    public function update(User $user, Epk $epk): bool
    {
        return $this->isEditorLevel($user, $epk->workspace);
    }

    public function delete(User $user, Epk $epk): bool
    {
        return $this->isAdminLevel($user, $epk->workspace);
    }

    public function duplicate(User $user, Epk $epk): bool
    {
        return $this->isEditorLevel($user, $epk->workspace);
    }

    public function publish(User $user, Epk $epk): bool
    {
        return $this->isEditorLevel($user, $epk->workspace);
    }
}
