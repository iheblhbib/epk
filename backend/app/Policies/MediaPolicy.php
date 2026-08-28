<?php

namespace App\Policies;

use App\Models\Media;
use App\Models\User;
use App\Models\Workspace;
use App\Policies\Concerns\InteractsWithWorkspaceMembership;

class MediaPolicy
{
    use InteractsWithWorkspaceMembership;

    public function viewAny(User $user, Workspace $workspace): bool
    {
        return $this->isMember($user, $workspace);
    }

    public function view(User $user, Media $media): bool
    {
        return $this->isMember($user, $media->workspace);
    }

    public function create(User $user, Workspace $workspace): bool
    {
        return $this->isEditorLevel($user, $workspace);
    }

    public function update(User $user, Media $media): bool
    {
        return $this->isEditorLevel($user, $media->workspace);
    }

    public function delete(User $user, Media $media): bool
    {
        return $this->isEditorLevel($user, $media->workspace);
    }
}
