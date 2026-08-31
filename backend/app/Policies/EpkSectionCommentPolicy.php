<?php

namespace App\Policies;

use App\Models\EpkSectionComment;
use App\Models\User;
use App\Policies\Concerns\InteractsWithWorkspaceMembership;

class EpkSectionCommentPolicy
{
    use InteractsWithWorkspaceMembership;

    // Editing your own comment is a correction, not moderation — nobody
    // else's business, not even an owner's.
    public function update(User $user, EpkSectionComment $comment): bool
    {
        return $comment->user_id === $user->id;
    }

    // Deletion is also available to admin-level teammates: the equivalent
    // of a moderator removing a stale or off-base note from a review
    // thread, same tier that can already remove a member from the
    // workspace outright.
    public function delete(User $user, EpkSectionComment $comment): bool
    {
        if ($comment->user_id === $user->id) {
            return true;
        }

        return $this->isAdminLevel($user, $comment->section->epk->workspace);
    }
}
