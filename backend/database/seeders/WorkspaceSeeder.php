<?php

namespace Database\Seeders;

use App\Enums\SubscriptionPlan;
use App\Enums\SubscriptionStatus;
use App\Enums\WorkspaceMemberStatus;
use App\Enums\WorkspaceRole;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Database\Seeder;

class WorkspaceSeeder extends Seeder
{
    /**
     * Seed a demo workspace, owned by the given user, with a couple of
     * teammates so the Team page isn't empty on first login.
     */
    public function run(User $owner): void
    {
        $workspace = Workspace::factory()->create([
            'name' => 'KORAXX Demo',
            'slug' => 'koraxx-demo',
            'description' => 'A sandbox workspace pre-loaded for exploring the dashboard.',
            'created_by' => $owner->id,
        ]);

        // A demo/sandbox workspace should showcase every feature indefinitely,
        // not be time-boxed to a 14-day trial like a normal new workspace --
        // it already ships with 3 members and is meant to demo private links,
        // custom themes, etc. `Workspace::booted()` already grants a trial at
        // Business-tier limits; this just makes it permanent (status=Active,
        // no trial_ends_at) rather than something that'll eventually expire.
        $workspace->subscription()->updateOrCreate([], [
            'plan' => SubscriptionPlan::Business,
            'status' => SubscriptionStatus::Active,
            'trial_ends_at' => null,
        ]);

        $workspace->members()->create([
            'user_id' => $owner->id,
            'role' => WorkspaceRole::Owner,
            'status' => WorkspaceMemberStatus::Active,
            'joined_at' => now(),
        ]);

        $editor = User::factory()->create([
            'name' => 'Jamie Rivers',
            'email' => 'jamie@koraxx.test',
            'email_verified_at' => now(),
        ]);

        $workspace->members()->create([
            'user_id' => $editor->id,
            'role' => WorkspaceRole::Editor,
            'status' => WorkspaceMemberStatus::Active,
            'joined_at' => now(),
        ]);

        $workspace->members()->create([
            'invited_email' => 'pending-invite@koraxx.test',
            'invited_by' => $owner->id,
            'invite_token' => str()->random(64),
            'role' => WorkspaceRole::Viewer,
            'status' => WorkspaceMemberStatus::Pending,
        ]);
    }
}
