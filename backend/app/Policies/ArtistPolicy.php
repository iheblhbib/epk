<?php

namespace App\Policies;

use App\Models\Artist;
use App\Models\User;
use App\Models\Workspace;
use App\Policies\Concerns\InteractsWithWorkspaceMembership;

class ArtistPolicy
{
    use InteractsWithWorkspaceMembership;

    public function viewAny(User $user, Workspace $workspace): bool
    {
        return $this->isMember($user, $workspace);
    }

    public function view(User $user, Artist $artist): bool
    {
        return $this->isMember($user, $artist->workspace);
    }

    public function create(User $user, Workspace $workspace): bool
    {
        return $this->isEditorLevel($user, $workspace);
    }

    public function update(User $user, Artist $artist): bool
    {
        return $this->isEditorLevel($user, $artist->workspace);
    }

    public function delete(User $user, Artist $artist): bool
    {
        return $this->isAdminLevel($user, $artist->workspace);
    }
}
