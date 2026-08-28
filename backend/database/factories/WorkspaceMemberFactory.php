<?php

namespace Database\Factories;

use App\Enums\WorkspaceMemberStatus;
use App\Enums\WorkspaceRole;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceMember;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<WorkspaceMember>
 */
class WorkspaceMemberFactory extends Factory
{
    public function definition(): array
    {
        return [
            'workspace_id' => Workspace::factory(),
            'user_id' => User::factory(),
            'role' => WorkspaceRole::Viewer,
            'status' => WorkspaceMemberStatus::Active,
            'joined_at' => now(),
        ];
    }

    public function owner(): static
    {
        return $this->state(fn (array $attributes) => ['role' => WorkspaceRole::Owner]);
    }

    public function admin(): static
    {
        return $this->state(fn (array $attributes) => ['role' => WorkspaceRole::Admin]);
    }

    public function editor(): static
    {
        return $this->state(fn (array $attributes) => ['role' => WorkspaceRole::Editor]);
    }

    public function viewer(): static
    {
        return $this->state(fn (array $attributes) => ['role' => WorkspaceRole::Viewer]);
    }

    public function pending(): static
    {
        return $this->state(fn (array $attributes) => [
            'user_id' => null,
            'invited_email' => fake()->unique()->safeEmail(),
            'status' => WorkspaceMemberStatus::Pending,
            'joined_at' => null,
        ]);
    }
}
