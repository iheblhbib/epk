<?php

use App\Enums\WorkspaceRole;
use App\Models\Artist;
use App\Models\Contact;
use App\Models\Epk;
use App\Models\Media;
use App\Models\User;
use App\Models\Workspace;

function searchTestWorkspaceWithOwner(): array
{
    $workspace = Workspace::factory()->create();
    $owner = User::factory()->create();
    $workspace->members()->create(['user_id' => $owner->id, 'role' => WorkspaceRole::Owner, 'status' => 'active', 'joined_at' => now()]);

    return [$workspace, $owner];
}

it('finds matches across epks, artists, contacts, and media', function () {
    [$workspace, $owner] = searchTestWorkspaceWithOwner();
    $artist = Artist::factory()->create(['workspace_id' => $workspace->id, 'name' => 'Nova Ray']);
    Epk::factory()->create(['workspace_id' => $workspace->id, 'artist_id' => $artist->id, 'title' => 'Nova Ray Live EPK']);
    Contact::factory()->create(['workspace_id' => $workspace->id, 'name' => 'Nova at Rolling Stone', 'email' => 'editor@example.com']);
    Media::factory()->create(['workspace_id' => $workspace->id, 'original_filename' => 'nova-ray-portrait.jpg']);
    Epk::factory()->create(['workspace_id' => $workspace->id, 'artist_id' => $artist->id, 'title' => 'Unrelated EPK']);

    $response = $this->actingAs($owner)
        ->getJson("/api/workspaces/{$workspace->id}/search?q=nova")
        ->assertOk();

    expect($response->json('data.epks'))->toHaveCount(1);
    expect($response->json('data.epks.0.title'))->toBe('Nova Ray Live EPK');
    expect($response->json('data.artists.0.name'))->toBe('Nova Ray');
    expect($response->json('data.contacts.0.name'))->toBe('Nova at Rolling Stone');
    expect($response->json('data.media.0.filename'))->toBe('nova-ray-portrait.jpg');
});

it('matches a contact by email or organization even when the name does not match', function () {
    [$workspace, $owner] = searchTestWorkspaceWithOwner();
    Contact::factory()->create([
        'workspace_id' => $workspace->id,
        'name' => 'Jamie Lee',
        'email' => 'jamie@pitchfork.example',
        'organization' => 'Pitchfork',
    ]);

    $byEmail = $this->actingAs($owner)->getJson("/api/workspaces/{$workspace->id}/search?q=pitchfork.example")->assertOk();
    expect($byEmail->json('data.contacts'))->toHaveCount(1);

    $byOrg = $this->actingAs($owner)->getJson("/api/workspaces/{$workspace->id}/search?q=Pitchfork")->assertOk();
    expect($byOrg->json('data.contacts'))->toHaveCount(1);
});

it('returns nothing for a query shorter than 2 characters', function () {
    [$workspace, $owner] = searchTestWorkspaceWithOwner();
    Artist::factory()->create(['workspace_id' => $workspace->id, 'name' => 'X']);

    $response = $this->actingAs($owner)->getJson("/api/workspaces/{$workspace->id}/search?q=x")->assertOk();

    expect($response->json('data.artists'))->toBe([]);
});

it('never returns results from a different workspace', function () {
    [$workspaceA, $ownerA] = searchTestWorkspaceWithOwner();
    [$workspaceB] = searchTestWorkspaceWithOwner();
    Artist::factory()->create(['workspace_id' => $workspaceB->id, 'name' => 'Nova Ray']);

    $response = $this->actingAs($ownerA)->getJson("/api/workspaces/{$workspaceA->id}/search?q=nova")->assertOk();

    expect($response->json('data.artists'))->toBe([]);
});

it('denies a non-member from searching a workspace', function () {
    [$workspace] = searchTestWorkspaceWithOwner();
    $outsider = User::factory()->create();

    $this->actingAs($outsider)
        ->getJson("/api/workspaces/{$workspace->id}/search?q=nova")
        ->assertForbidden();
});
