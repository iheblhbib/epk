<?php

namespace Database\Seeders;

use App\Enums\SubscriptionPlan;
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
            'name' => 'KORAX Demo',
            'slug' => 'korax-demo',
            'description' => 'A sandbox workspace pre-loaded for exploring the dashboard.',
            'created_by' => $owner->id,
        ]);

        // A demo/sandbox workspace should showcase every feature, not get
        // capped by the Free plan's limits the moment it's explored — it
        // already ships with 3 members and is meant to demo private links,
        // custom themes, etc. `Workspace::booted()` gives it a Free
        // subscription automatically; this upgrades that row (updateOrCreate
        // rather than update() so this stays correct even if that event
        // hook is ever bypassed).
        $workspace->subscription()->updateOrCreate([], ['plan' => SubscriptionPlan::Business]);

        $workspace->members()->create([
            'user_id' => $owner->id,
            'role' => WorkspaceRole::Owner,
            'status' => WorkspaceMemberStatus::Active,
            'joined_at' => now(),
        ]);

        $editor = User::factory()->create([
            'name' => 'Jamie Rivers',
            'email' => 'jamie@korax.test',
            'email_verified_at' => now(),
        ]);

        $workspace->members()->create([
            'user_id' => $editor->id,
            'role' => WorkspaceRole::Editor,
            'status' => WorkspaceMemberStatus::Active,
            'joined_at' => now(),
        ]);

        $workspace->members()->create([
            'invited_email' => 'pending-invite@korax.test',
            'invited_by' => $owner->id,
            'invite_token' => str()->random(64),
            'role' => WorkspaceRole::Viewer,
            'status' => WorkspaceMemberStatus::Pending,
        ]);
    }
}
