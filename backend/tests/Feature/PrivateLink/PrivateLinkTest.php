<?php

use App\Enums\SubscriptionPlan;
use App\Enums\WorkspaceRole;
use App\Models\Artist;
use App\Models\Epk;
use App\Models\PrivateLink;
use App\Models\User;
use App\Models\Workspace;

function linkWorkspaceWithMember(WorkspaceRole $role): array
{
    $workspace = Workspace::factory()->create();
    // Private links are a Pro+ feature as of Phase 13 — the plan gate
    // itself is covered by Tests\Feature\Billing\PlanLimitsTest, so this
    // file's tests (about the private-link mechanics) run on a plan that
    // doesn't block them.
    $workspace->subscription()->update(['plan' => SubscriptionPlan::Pro]);
    $user = User::factory()->create();
    $workspace->members()->create(['user_id' => $user->id, 'role' => $role, 'status' => 'active', 'joined_at' => now()]);

    return [$workspace, $user];
}

function epkFor(Workspace $workspace): Epk
{
    $artist = Artist::factory()->create(['workspace_id' => $workspace->id]);

    return Epk::factory()->create(['workspace_id' => $workspace->id, 'artist_id' => $artist->id]);
}

it('lets an editor create a private link', function () {
    [$workspace, $editor] = linkWorkspaceWithMember(WorkspaceRole::Editor);
    $epk = epkFor($workspace);

    $response = $this->actingAs($editor)->postJson("/api/epks/{$epk->id}/private-links", [
        'label' => 'For Rolling Stone',
        'password' => 'letmein123',
    ]);

    $response->assertCreated();
    $response->assertJsonPath('data.label', 'For Rolling Stone');
    $response->assertJsonPath('data.requires_password', true);
    $response->assertJsonPath('data.is_active', true);
    // Regression: the immediate response must show 0, not null — Eloquent
    // doesn't sync a column's DB-level default back into the in-memory
    // model after save() unless it's set explicitly in the controller.
    $response->assertJsonPath('data.view_count', 0);
    expect($response->json('data'))->not->toHaveKeys(['password', 'password_hash']);

    $this->assertDatabaseHas('private_links', ['epk_id' => $epk->id, 'label' => 'For Rolling Stone']);
});

it('creates a link without a password', function () {
    [$workspace, $editor] = linkWorkspaceWithMember(WorkspaceRole::Editor);
    $epk = epkFor($workspace);

    $response = $this->actingAs($editor)->postJson("/api/epks/{$epk->id}/private-links", []);

    $response->assertCreated();
    $response->assertJsonPath('data.requires_password', false);
});

it('denies a viewer from creating a private link', function () {
    [$workspace, $viewer] = linkWorkspaceWithMember(WorkspaceRole::Viewer);
    $epk = epkFor($workspace);

    $this->actingAs($viewer)->postJson("/api/epks/{$epk->id}/private-links", [])->assertForbidden();
});

it('rejects an expiry date in the past', function () {
    [$workspace, $editor] = linkWorkspaceWithMember(WorkspaceRole::Editor);
    $epk = epkFor($workspace);

    $this->actingAs($editor)
        ->postJson("/api/epks/{$epk->id}/private-links", ['expires_at' => now()->subDay()->toIso8601String()])
        ->assertUnprocessable();
});

it('lists private links for an epk, any workspace member can view', function () {
    [$workspace, $viewer] = linkWorkspaceWithMember(WorkspaceRole::Viewer);
    $epk = epkFor($workspace);
    PrivateLink::factory()->for($epk)->count(2)->create();

    $response = $this->actingAs($viewer)->getJson("/api/epks/{$epk->id}/private-links");

    $response->assertOk();
    expect($response->json('data'))->toHaveCount(2);
});

it('updates a link\'s label and expiry', function () {
    [$workspace, $editor] = linkWorkspaceWithMember(WorkspaceRole::Editor);
    $epk = epkFor($workspace);
    $link = PrivateLink::factory()->for($epk)->create(['label' => 'Old label']);

    $response = $this->actingAs($editor)->putJson("/api/epks/{$epk->id}/private-links/{$link->id}", [
        'label' => 'New label',
    ]);

    $response->assertOk();
    $response->assertJsonPath('data.label', 'New label');
});

it('sets and clears a password via update', function () {
    [$workspace, $editor] = linkWorkspaceWithMember(WorkspaceRole::Editor);
    $epk = epkFor($workspace);
    $link = PrivateLink::factory()->for($epk)->create();

    $this->actingAs($editor)
        ->putJson("/api/epks/{$epk->id}/private-links/{$link->id}", ['password' => 'newpass1'])
        ->assertOk()
        ->assertJsonPath('data.requires_password', true);

    expect($link->fresh()->checkPassword('newpass1'))->toBeTrue();

    $this->actingAs($editor)
        ->putJson("/api/epks/{$epk->id}/private-links/{$link->id}", ['password' => null])
        ->assertOk()
        ->assertJsonPath('data.requires_password', false);
});

it('revokes and reactivates a link via update', function () {
    [$workspace, $editor] = linkWorkspaceWithMember(WorkspaceRole::Editor);
    $epk = epkFor($workspace);
    $link = PrivateLink::factory()->for($epk)->create();

    $this->actingAs($editor)
        ->putJson("/api/epks/{$epk->id}/private-links/{$link->id}", ['revoked' => true])
        ->assertOk()
        ->assertJsonPath('data.is_active', false);

    expect($link->fresh()->isRevoked())->toBeTrue();

    $this->actingAs($editor)
        ->putJson("/api/epks/{$epk->id}/private-links/{$link->id}", ['revoked' => false])
        ->assertOk()
        ->assertJsonPath('data.is_active', true);
});

it('deletes a link', function () {
    [$workspace, $editor] = linkWorkspaceWithMember(WorkspaceRole::Editor);
    $epk = epkFor($workspace);
    $link = PrivateLink::factory()->for($epk)->create();

    $this->actingAs($editor)->deleteJson("/api/epks/{$epk->id}/private-links/{$link->id}")->assertOk();

    $this->assertDatabaseMissing('private_links', ['id' => $link->id]);
});

it('404s updating a link that belongs to a different epk', function () {
    [$workspace, $editor] = linkWorkspaceWithMember(WorkspaceRole::Editor);
    $epk = epkFor($workspace);
    $otherEpk = epkFor($workspace);
    $link = PrivateLink::factory()->for($otherEpk)->create();

    $this->actingAs($editor)
        ->putJson("/api/epks/{$epk->id}/private-links/{$link->id}", ['label' => 'x'])
        ->assertNotFound();
});
