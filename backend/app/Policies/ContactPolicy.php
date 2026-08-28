<?php

namespace App\Policies;

use App\Models\Contact;
use App\Models\User;
use App\Models\Workspace;
use App\Policies\Concerns\InteractsWithWorkspaceMembership;

class ContactPolicy
{
    use InteractsWithWorkspaceMembership;

    public function viewAny(User $user, Workspace $workspace): bool
    {
        return $this->isMember($user, $workspace);
    }

    public function view(User $user, Contact $contact): bool
    {
        return $this->isMember($user, $contact->workspace);
    }

    public function create(User $user, Workspace $workspace): bool
    {
        return $this->isEditorLevel($user, $workspace);
    }

    public function update(User $user, Contact $contact): bool
    {
        return $this->isEditorLevel($user, $contact->workspace);
    }

    public function delete(User $user, Contact $contact): bool
    {
        return $this->isEditorLevel($user, $contact->workspace);
    }

    public function import(User $user, Workspace $workspace): bool
    {
        return $this->isEditorLevel($user, $workspace);
    }
}
