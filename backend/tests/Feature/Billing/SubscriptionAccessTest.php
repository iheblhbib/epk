<?php

use App\Enums\SubscriptionStatus;
use App\Enums\WorkspaceRole;
use App\Models\Artist;
use App\Models\User;
use App\Models\Workspace;

function accessTestWorkspace(): array
{
    $owner = User::factory()->create();
    $workspace = Workspace::factory()->create(['created_by' => $owner->id]);
    $workspace->members()->create(['user_id' => $owner->id, 'role' => WorkspaceRole::Owner, 'status' => 'active', 'joined_at' => now()]);

    return [$workspace, $owner];
}

it('allows access while a trial is still running', function () {
    [$workspace, $owner] = accessTestWorkspace();

    $this->actingAs($owner)
        ->getJson("/api/workspaces/{$workspace->id}")
        ->assertOk();
});

it('blocks a workspace-scoped route once the trial has expired with no paid subscription', function () {
    [$workspace, $owner] = accessTestWorkspace();
    $workspace->subscription()->update(['trial_ends_at' => now()->subDay()]);

    $this->actingAs($owner)
        ->getJson("/api/workspaces/{$workspace->id}")
        ->assertStatus(402);
});

it('blocks an epk-scoped route via the epk\'s own workspace once locked out', function () {
    [$workspace, $owner] = accessTestWorkspace();
    $workspace->subscription()->update(['trial_ends_at' => now()->subDay()]);
    $artist = Artist::factory()->create(['workspace_id' => $workspace->id]);

    $this->actingAs($owner)
        ->postJson('/api/epks', ['workspace_id' => $workspace->id, 'artist_id' => $artist->id, 'title' => 'Nope'])
        ->assertStatus(402);
});

it('still allows access once a workspace has an active paid subscription, trial or not', function () {
    [$workspace, $owner] = accessTestWorkspace();
    $workspace->subscription()->update(['status' => SubscriptionStatus::Active, 'trial_ends_at' => now()->subDay()]);

    $this->actingAs($owner)
        ->getJson("/api/workspaces/{$workspace->id}")
        ->assertOk();
});

it('blocks a canceled subscription with no active trial', function () {
    [$workspace, $owner] = accessTestWorkspace();
    $workspace->subscription()->update(['status' => SubscriptionStatus::Canceled, 'trial_ends_at' => now()->subDay()]);

    $this->actingAs($owner)
        ->getJson("/api/workspaces/{$workspace->id}")
        ->assertStatus(402);
});

it('keeps access during the past_due grace period while Stripe retries', function () {
    [$workspace, $owner] = accessTestWorkspace();
    $workspace->subscription()->update(['status' => SubscriptionStatus::PastDue, 'trial_ends_at' => null]);

    $this->actingAs($owner)
        ->getJson("/api/workspaces/{$workspace->id}")
        ->assertOk();
});

it('blocks an unpaid subscription once Stripe has exhausted its retries', function () {
    [$workspace, $owner] = accessTestWorkspace();
    $workspace->subscription()->update(['status' => SubscriptionStatus::Unpaid, 'trial_ends_at' => null]);

    $this->actingAs($owner)
        ->getJson("/api/workspaces/{$workspace->id}")
        ->assertStatus(402);
});

it('never blocks the billing routes themselves, even when locked out', function () {
    [$workspace, $owner] = accessTestWorkspace();
    $workspace->subscription()->update(['trial_ends_at' => now()->subDay()]);

    $this->actingAs($owner)
        ->getJson("/api/workspaces/{$workspace->id}/billing")
        ->assertOk();
});
