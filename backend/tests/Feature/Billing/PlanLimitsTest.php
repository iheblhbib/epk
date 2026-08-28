<?php

use App\Enums\SubscriptionPlan;
use App\Enums\WorkspaceRole;
use App\Models\Artist;
use App\Models\Epk;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

function billingWorkspaceWithOwner(): array
{
    $owner = User::factory()->create();
    $workspace = Workspace::factory()->create(['created_by' => $owner->id]);
    $workspace->members()->create(['user_id' => $owner->id, 'role' => WorkspaceRole::Owner, 'status' => 'active', 'joined_at' => now()]);

    return [$workspace, $owner];
}

it('gives every new workspace a free subscription automatically', function () {
    [$workspace] = billingWorkspaceWithOwner();

    expect($workspace->subscription)->not->toBeNull();
    expect($workspace->subscription->plan)->toBe(SubscriptionPlan::Free);
});

it('blocks creating a second epk on the free plan', function () {
    [$workspace, $owner] = billingWorkspaceWithOwner();
    $artist = Artist::factory()->create(['workspace_id' => $workspace->id]);
    Epk::factory()->create(['workspace_id' => $workspace->id, 'artist_id' => $artist->id]);

    $this->actingAs($owner)->postJson('/api/epks', [
        'workspace_id' => $workspace->id,
        'artist_id' => $artist->id,
        'title' => 'One EPK Too Many',
    ])->assertUnprocessable();
});

it('allows a second epk once the workspace is on a paid plan', function () {
    [$workspace, $owner] = billingWorkspaceWithOwner();
    $workspace->subscription()->update(['plan' => SubscriptionPlan::Pro]);
    $artist = Artist::factory()->create(['workspace_id' => $workspace->id]);
    Epk::factory()->create(['workspace_id' => $workspace->id, 'artist_id' => $artist->id]);

    $this->actingAs($owner)->postJson('/api/epks', [
        'workspace_id' => $workspace->id,
        'artist_id' => $artist->id,
        'title' => 'Second EPK',
    ])->assertCreated();
});

it('blocks custom theme overrides on the free plan but still allows picking a preset', function () {
    [$workspace, $owner] = billingWorkspaceWithOwner();
    $artist = Artist::factory()->create(['workspace_id' => $workspace->id]);
    $epk = Epk::factory()->create(['workspace_id' => $workspace->id, 'artist_id' => $artist->id]);

    $this->actingAs($owner)->putJson("/api/epks/{$epk->id}", ['theme' => 'dark'])
        ->assertOk()
        ->assertJsonPath('data.theme', 'dark');

    $this->actingAs($owner)->putJson("/api/epks/{$epk->id}", [
        'custom_settings' => ['accent_color' => '#ff0000'],
    ])->assertUnprocessable();
});

it('blocks creating a private link on the free plan', function () {
    [$workspace, $owner] = billingWorkspaceWithOwner();
    $artist = Artist::factory()->create(['workspace_id' => $workspace->id]);
    $epk = Epk::factory()->create(['workspace_id' => $workspace->id, 'artist_id' => $artist->id]);

    $this->actingAs($owner)->postJson("/api/epks/{$epk->id}/private-links", ['label' => 'For the label'])
        ->assertUnprocessable();
});

it('blocks inviting past the free plan team member limit', function () {
    [$workspace, $owner] = billingWorkspaceWithOwner();
    $second = User::factory()->create();
    $workspace->members()->create(['user_id' => $second->id, 'role' => WorkspaceRole::Editor, 'status' => 'active', 'joined_at' => now()]);

    // Free plan's max_team_members is 2, and the workspace already has 2.
    $this->actingAs($owner)->postJson("/api/workspaces/{$workspace->id}/members", [
        'email' => 'third@example.com',
        'role' => WorkspaceRole::Viewer->value,
    ])->assertUnprocessable();
});

it('blocks a media upload that would exceed the plan storage limit', function () {
    Storage::fake('public');
    config(['plans.free.max_storage_bytes' => 1024]); // 1KB, smaller than any real fake image
    [$workspace, $owner] = billingWorkspaceWithOwner();

    $this->actingAs($owner)->postJson("/api/workspaces/{$workspace->id}/media", [
        'files' => [UploadedFile::fake()->image('cover.jpg', 200, 200)],
    ])->assertUnprocessable();
});

it('lets an admin change a workspace plan, unlocking that workspace’s limits', function () {
    $admin = User::factory()->admin()->create();
    [$workspace] = billingWorkspaceWithOwner();

    $this->actingAs($admin)->patchJson("/api/admin/workspaces/{$workspace->id}/subscription", [
        'plan' => SubscriptionPlan::Business->value,
    ])->assertOk()->assertJsonPath('data.plan', SubscriptionPlan::Business->value);

    expect($workspace->subscription->fresh()->plan)->toBe(SubscriptionPlan::Business);
    $this->assertDatabaseHas('audit_logs', ['action' => 'workspace.plan_changed_by_admin', 'subject_id' => $workspace->id]);
});

it('returns plan, usage, and the plan comparison table from the billing endpoint', function () {
    [$workspace, $owner] = billingWorkspaceWithOwner();

    $response = $this->actingAs($owner)->getJson("/api/workspaces/{$workspace->id}/billing");

    $response->assertOk()
        ->assertJsonPath('data.plan', SubscriptionPlan::Free->value)
        ->assertJsonPath('data.usage.epks.limit', 1)
        ->assertJsonStructure(['data' => ['plan', 'usage', 'plans' => ['free', 'pro', 'business']]]);
});
