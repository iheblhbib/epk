<?php

namespace App\Services;

use App\Enums\WorkspaceMemberStatus;
use App\Enums\WorkspaceRole;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Support\Str;

/**
 * The one place a Workspace + its owner membership get created -- shared by
 * the manual "Create workspace" flow (WorkspaceController) and the
 * auto-created first workspace a new user gets at registration
 * (RegisteredUserController), so the slug-uniqueness logic exists once.
 */
class WorkspaceCreator
{
    public function createWithOwner(string $name, User $owner, ?string $description = null): Workspace
    {
        $workspace = Workspace::create([
            'name' => $name,
            'slug' => $this->uniqueSlug($name),
            'description' => $description,
            'created_by' => $owner->id,
        ]);

        $workspace->members()->create([
            'user_id' => $owner->id,
            'role' => WorkspaceRole::Owner,
            'status' => WorkspaceMemberStatus::Active,
            'joined_at' => now(),
        ]);

        return $workspace;
    }

    private function uniqueSlug(string $name): string
    {
        $base = Str::slug($name) ?: 'workspace';
        $slug = $base;
        $suffix = 1;

        while (Workspace::withTrashed()->where('slug', $slug)->exists()) {
            $slug = "{$base}-".++$suffix;
        }

        return $slug;
    }
}
