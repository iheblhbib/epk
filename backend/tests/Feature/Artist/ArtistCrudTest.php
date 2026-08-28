<?php

use App\Enums\WorkspaceRole;
use App\Models\Artist;
use App\Models\Epk;
use App\Models\User;
use App\Models\Workspace;

function workspaceWithRole(WorkspaceRole $role): array
{
    $workspace = Workspace::factory()->create();
    $user = User::factory()->create();
    $workspace->members()->create(['user_id' => $user->id, 'role' => $role, 'status' => 'active', 'joined_at' => now()]);

    return [$workspace, $user];
}

it('lets an editor create an artist in their workspace', function () {
    [$workspace, $editor] = workspaceWithRole(WorkspaceRole::Editor);

    $response = $this->actingAs($editor)->postJson("/api/workspaces/{$workspace->id}/artists", [
        'name' => 'Ada Lovelace',
        'genre' => 'Electronic',
    ]);

    $response->assertCreated()->assertJsonPath('data.name', 'Ada Lovelace');
    $this->assertDatabaseHas('artists', ['workspace_id' => $workspace->id, 'name' => 'Ada Lovelace']);
});

it('denies a viewer from creating an artist', function () {
    [$workspace, $viewer] = workspaceWithRole(WorkspaceRole::Viewer);

    $this->actingAs($viewer)
        ->postJson("/api/workspaces/{$workspace->id}/artists", ['name' => 'Ada Lovelace'])
        ->assertForbidden();
});

it('lists only artists belonging to the workspace', function () {
    [$workspace, $viewer] = workspaceWithRole(WorkspaceRole::Viewer);
    Artist::factory()->count(2)->create(['workspace_id' => $workspace->id]);
    Artist::factory()->create();

    $response = $this->actingAs($viewer)->getJson("/api/workspaces/{$workspace->id}/artists");

    $response->assertOk();
    expect($response->json('data'))->toHaveCount(2);
});

it('updates an artist as an editor', function () {
    [$workspace, $editor] = workspaceWithRole(WorkspaceRole::Editor);
    $artist = Artist::factory()->create(['workspace_id' => $workspace->id, 'name' => 'Old Name']);

    $this->actingAs($editor)
        ->putJson("/api/artists/{$artist->id}", ['name' => 'New Name'])
        ->assertOk()
        ->assertJsonPath('data.name', 'New Name');
});

it('only lets an admin delete an artist with no EPKs', function () {
    [$workspace, $editor] = workspaceWithRole(WorkspaceRole::Editor);
    [, $admin] = workspaceWithRole(WorkspaceRole::Admin);
    $artist = Artist::factory()->create(['workspace_id' => $workspace->id]);

    $this->actingAs($editor)->deleteJson("/api/artists/{$artist->id}")->assertForbidden();

    $workspace->members()->create(['user_id' => $admin->id, 'role' => WorkspaceRole::Admin, 'status' => 'active', 'joined_at' => now()]);
    $this->actingAs($admin)->deleteJson("/api/artists/{$artist->id}")->assertOk();

    $this->assertSoftDeleted('artists', ['id' => $artist->id]);
});

it('blocks deleting an artist that still has EPKs', function () {
    [$workspace, $admin] = workspaceWithRole(WorkspaceRole::Admin);
    $artist = Artist::factory()->create(['workspace_id' => $workspace->id]);
    Epk::factory()->create(['workspace_id' => $workspace->id, 'artist_id' => $artist->id]);

    $this->actingAs($admin)
        ->deleteJson("/api/artists/{$artist->id}")
        ->assertUnprocessable()
        ->assertJsonValidationErrors('artist');

    $this->assertDatabaseHas('artists', ['id' => $artist->id, 'deleted_at' => null]);
});
