<?php

use App\Enums\SectionType;
use App\Enums\WorkspaceRole;
use App\Models\Artist;
use App\Models\Epk;
use App\Models\User;
use App\Models\Workspace;

function activityTestWorkspaceWithOwner(): array
{
    $workspace = Workspace::factory()->create();
    $owner = User::factory()->create();
    $workspace->members()->create(['user_id' => $owner->id, 'role' => WorkspaceRole::Owner, 'status' => 'active', 'joined_at' => now()]);

    return [$workspace, $owner];
}

it('records an epk lifecycle in the workspace activity feed', function () {
    [$workspace, $owner] = activityTestWorkspaceWithOwner();
    $artist = Artist::factory()->create(['workspace_id' => $workspace->id]);

    $create = $this->actingAs($owner)->postJson('/api/epks', [
        'workspace_id' => $workspace->id,
        'artist_id' => $artist->id,
        'title' => 'Nova Ray EPK',
    ])->assertCreated();
    $epkId = $create->json('data.id');

    $this->actingAs($owner)->postJson("/api/epks/{$epkId}/publish")->assertOk();
    $this->actingAs($owner)->postJson("/api/epks/{$epkId}/unpublish")->assertOk();
    $this->actingAs($owner)->deleteJson("/api/epks/{$epkId}")->assertOk();

    $response = $this->actingAs($owner)->getJson("/api/workspaces/{$workspace->id}/activity")->assertOk();

    $actions = collect($response->json('data'))->pluck('action')->values()->all();
    // Newest first.
    expect($actions)->toBe(['epk.deleted', 'epk.unpublished', 'epk.published', 'epk.created']);
    expect($response->json('data.0.user.name'))->toBe($owner->name);
    expect($response->json('meta.total'))->toBe(4);
});

it('records team membership changes in the activity feed', function () {
    [$workspace, $owner] = activityTestWorkspaceWithOwner();
    $invitee = User::factory()->create();

    $this->actingAs($owner)->postJson("/api/workspaces/{$workspace->id}/members", [
        'email' => $invitee->email,
        'role' => WorkspaceRole::Viewer->value,
    ])->assertCreated();

    $member = $workspace->members()->where('user_id', $invitee->id)->first();

    $this->actingAs($owner)->putJson("/api/workspaces/{$workspace->id}/members/{$member->id}", [
        'role' => WorkspaceRole::Editor->value,
    ])->assertOk();

    $this->actingAs($owner)->deleteJson("/api/workspaces/{$workspace->id}/members/{$member->id}")->assertOk();

    $response = $this->actingAs($owner)->getJson("/api/workspaces/{$workspace->id}/activity")->assertOk();
    $actions = collect($response->json('data'))->pluck('action')->values()->all();

    expect($actions)->toBe(['member.removed', 'member.role_changed', 'member.invited']);
});

it('records a workspace settings update', function () {
    [$workspace, $owner] = activityTestWorkspaceWithOwner();

    $this->actingAs($owner)->putJson("/api/workspaces/{$workspace->id}", ['name' => 'Renamed Workspace'])->assertOk();

    $this->actingAs($owner)->getJson("/api/workspaces/{$workspace->id}/activity")
        ->assertOk()
        ->assertJsonPath('data.0.action', 'workspace.updated');
});

it('never shows another workspace\'s activity', function () {
    [$workspaceA, $ownerA] = activityTestWorkspaceWithOwner();
    [$workspaceB, $ownerB] = activityTestWorkspaceWithOwner();
    $artist = Artist::factory()->create(['workspace_id' => $workspaceB->id]);
    $this->actingAs($ownerB)->postJson('/api/epks', [
        'workspace_id' => $workspaceB->id,
        'artist_id' => $artist->id,
        'title' => 'Other Workspace EPK',
    ])->assertCreated();

    $response = $this->actingAs($ownerA)->getJson("/api/workspaces/{$workspaceA->id}/activity")->assertOk();

    expect($response->json('data'))->toBe([]);
});

it('denies a non-member from viewing the activity feed', function () {
    [$workspace] = activityTestWorkspaceWithOwner();
    $outsider = User::factory()->create();

    $this->actingAs($outsider)
        ->getJson("/api/workspaces/{$workspace->id}/activity")
        ->assertForbidden();
});

it('does not log a section-level change as workspace activity', function () {
    [$workspace, $owner] = activityTestWorkspaceWithOwner();
    $artist = Artist::factory()->create(['workspace_id' => $workspace->id]);
    $epk = Epk::factory()->create(['workspace_id' => $workspace->id, 'artist_id' => $artist->id]);

    $this->actingAs($owner)->postJson("/api/epks/{$epk->id}/sections", ['type' => SectionType::Biography->value])->assertCreated();

    $response = $this->actingAs($owner)->getJson("/api/workspaces/{$workspace->id}/activity")->assertOk();

    expect($response->json('data'))->toBe([]);
});
