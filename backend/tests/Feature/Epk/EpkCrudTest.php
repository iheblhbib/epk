<?php

use App\Enums\EpkStatus;
use App\Enums\SubscriptionPlan;
use App\Enums\WorkspaceRole;
use App\Models\Artist;
use App\Models\Epk;
use App\Models\User;
use App\Models\Workspace;

function workspaceWithMember(WorkspaceRole $role): array
{
    $workspace = Workspace::factory()->create();
    $user = User::factory()->create();
    $workspace->members()->create(['user_id' => $user->id, 'role' => $role, 'status' => 'active', 'joined_at' => now()]);

    return [$workspace, $user];
}

it('lets an editor create an epk for an artist in the same workspace', function () {
    [$workspace, $editor] = workspaceWithMember(WorkspaceRole::Editor);
    $artist = Artist::factory()->create(['workspace_id' => $workspace->id]);

    $response = $this->actingAs($editor)->postJson('/api/epks', [
        'workspace_id' => $workspace->id,
        'artist_id' => $artist->id,
        'title' => 'Summer Tour EPK',
    ]);

    $response->assertCreated()
        ->assertJsonPath('data.title', 'Summer Tour EPK')
        ->assertJsonPath('data.status', EpkStatus::Draft->value)
        ->assertJsonPath('data.slug', 'summer-tour-epk');

    $this->assertDatabaseHas('epks', ['workspace_id' => $workspace->id, 'artist_id' => $artist->id]);
});

it('denies a viewer from creating an epk', function () {
    [$workspace, $viewer] = workspaceWithMember(WorkspaceRole::Viewer);
    $artist = Artist::factory()->create(['workspace_id' => $workspace->id]);

    $this->actingAs($viewer)
        ->postJson('/api/epks', ['workspace_id' => $workspace->id, 'artist_id' => $artist->id, 'title' => 'Nope'])
        ->assertForbidden();
});

it('rejects an artist that belongs to a different workspace', function () {
    [$workspace, $editor] = workspaceWithMember(WorkspaceRole::Editor);
    $otherArtist = Artist::factory()->create();

    $this->actingAs($editor)
        ->postJson('/api/epks', ['workspace_id' => $workspace->id, 'artist_id' => $otherArtist->id, 'title' => 'Nope'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('artist_id');
});

it('generates a unique slug when titles collide', function () {
    [$workspace, $editor] = workspaceWithMember(WorkspaceRole::Editor);
    // Creates two EPKs, which the free plan's 1-EPK limit would otherwise
    // block — see Tests\Feature\Billing\PlanLimitsTest for that gate itself.
    $workspace->subscription()->update(['plan' => SubscriptionPlan::Pro]);
    $artist = Artist::factory()->create(['workspace_id' => $workspace->id]);

    $payload = ['workspace_id' => $workspace->id, 'artist_id' => $artist->id, 'title' => 'Same Title'];

    $first = $this->actingAs($editor)->postJson('/api/epks', $payload)->assertCreated();
    $second = $this->actingAs($editor)->postJson('/api/epks', $payload)->assertCreated();

    expect($first->json('data.slug'))->not->toBe($second->json('data.slug'));
});

it('lists only epks for the given workspace', function () {
    [$workspace, $viewer] = workspaceWithMember(WorkspaceRole::Viewer);
    Epk::factory()->count(2)->create(['workspace_id' => $workspace->id]);
    Epk::factory()->create();

    $response = $this->actingAs($viewer)->getJson("/api/epks?workspace_id={$workspace->id}");

    $response->assertOk();
    expect($response->json('data'))->toHaveCount(2);
});

it('enforces the update/delete permission matrix', function () {
    [$workspace, $editor] = workspaceWithMember(WorkspaceRole::Editor);
    $epk = Epk::factory()->create(['workspace_id' => $workspace->id]);

    $this->actingAs($editor)->putJson("/api/epks/{$epk->id}", ['title' => 'Updated'])->assertOk();
    $this->actingAs($editor)->deleteJson("/api/epks/{$epk->id}")->assertForbidden();

    [, $admin] = workspaceWithMember(WorkspaceRole::Admin);
    $workspace->members()->create(['user_id' => $admin->id, 'role' => WorkspaceRole::Admin, 'status' => 'active', 'joined_at' => now()]);
    $this->actingAs($admin)->deleteJson("/api/epks/{$epk->id}")->assertOk();

    $this->assertSoftDeleted('epks', ['id' => $epk->id]);
});

it('duplicates an epk as a fresh draft with a new slug and uuid', function () {
    [$workspace, $editor] = workspaceWithMember(WorkspaceRole::Editor);
    // Duplicating still counts against the free plan's 1-EPK limit (see the
    // "blocks duplicating" test below for that gate itself) — upgrade so
    // this test is only exercising the duplication mechanics.
    $workspace->subscription()->update(['plan' => SubscriptionPlan::Pro]);
    $epk = Epk::factory()->published()->create(['workspace_id' => $workspace->id, 'title' => 'Original']);

    $response = $this->actingAs($editor)->postJson("/api/epks/{$epk->id}/duplicate")->assertCreated();

    $response->assertJsonPath('data.title', 'Original (Copy)')
        ->assertJsonPath('data.status', EpkStatus::Draft->value);

    expect($response->json('data.slug'))->not->toBe($epk->slug);
    expect($response->json('data.uuid'))->not->toBe($epk->uuid);
    expect($response->json('data.published_at'))->toBeNull();
});

it('publishes and unpublishes an epk', function () {
    [$workspace, $editor] = workspaceWithMember(WorkspaceRole::Editor);
    $epk = Epk::factory()->create(['workspace_id' => $workspace->id]);

    $this->actingAs($editor)->postJson("/api/epks/{$epk->id}/publish")
        ->assertOk()
        ->assertJsonPath('data.status', EpkStatus::Published->value);

    expect($epk->fresh()->published_at)->not->toBeNull();

    $this->actingAs($editor)->postJson("/api/epks/{$epk->id}/publish")
        ->assertUnprocessable();

    $this->actingAs($editor)->postJson("/api/epks/{$epk->id}/unpublish")
        ->assertOk()
        ->assertJsonPath('data.status', EpkStatus::Draft->value);
});

it('lets an editor set the theme preset and customizations', function () {
    [$workspace, $editor] = workspaceWithMember(WorkspaceRole::Editor);
    // custom_settings overrides are a Pro+ feature as of Phase 13 — see
    // Tests\Feature\Billing\PlanLimitsTest for the free-plan gate itself.
    $workspace->subscription()->update(['plan' => SubscriptionPlan::Pro]);
    $epk = Epk::factory()->create(['workspace_id' => $workspace->id]);

    $response = $this->actingAs($editor)->putJson("/api/epks/{$epk->id}", [
        'theme' => 'editorial',
        'custom_settings' => [
            'accent_color' => '#FF00AA',
            'font' => 'serif',
            'button_style' => 'pill',
            'radius' => 'large',
            'spacing' => 'spacious',
            'header_style' => 'left',
        ],
    ]);

    $response->assertOk()
        ->assertJsonPath('data.theme', 'editorial')
        ->assertJsonPath('data.custom_settings.accent_color', '#FF00AA')
        ->assertJsonPath('data.custom_settings.font', 'serif');
});

it('rejects an unknown theme preset', function () {
    [$workspace, $editor] = workspaceWithMember(WorkspaceRole::Editor);
    $epk = Epk::factory()->create(['workspace_id' => $workspace->id]);

    $this->actingAs($editor)
        ->putJson("/api/epks/{$epk->id}", ['theme' => 'not-a-real-theme'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('theme');
});

it('rejects invalid custom_settings values and silently drops unknown keys', function () {
    [$workspace, $editor] = workspaceWithMember(WorkspaceRole::Editor);
    $workspace->subscription()->update(['plan' => SubscriptionPlan::Pro]);
    $epk = Epk::factory()->create(['workspace_id' => $workspace->id]);

    $this->actingAs($editor)
        ->putJson("/api/epks/{$epk->id}", ['custom_settings' => ['accent_color' => 'not-a-hex-color']])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('custom_settings.accent_color');

    $response = $this->actingAs($editor)->putJson("/api/epks/{$epk->id}", [
        'custom_settings' => ['accent_color' => '#123ABC', 'malicious_script' => '<script>alert(1)</script>'],
    ]);

    $response->assertOk();
    expect($response->json('data.custom_settings'))->toBe(['accent_color' => '#123ABC']);
});
