<?php

use App\Enums\WorkspaceRole;
use App\Models\Artist;
use App\Models\Epk;
use App\Models\User;
use App\Models\Workspace;

function makeWorkspaceWithTwoMembers(): array
{
    $owner = User::factory()->create();
    $teammate = User::factory()->create();
    $workspace = Workspace::factory()->create(['created_by' => $owner->id]);
    $workspace->members()->create(['user_id' => $owner->id, 'role' => WorkspaceRole::Owner, 'status' => 'active', 'joined_at' => now()]);
    $workspace->members()->create(['user_id' => $teammate->id, 'role' => WorkspaceRole::Editor, 'status' => 'active', 'joined_at' => now()]);

    return [$workspace, $owner, $teammate];
}

it('notifies other workspace members when an EPK is published', function () {
    [$workspace, $owner, $teammate] = makeWorkspaceWithTwoMembers();
    $artist = Artist::factory()->create(['workspace_id' => $workspace->id]);
    $epk = Epk::factory()->create(['workspace_id' => $workspace->id, 'artist_id' => $artist->id, 'title' => 'Nova Ray EPK']);

    $this->actingAs($owner)->postJson("/api/epks/{$epk->id}/publish")->assertOk();

    expect($teammate->notifications()->count())->toBe(1);
    $notification = $teammate->notifications()->first();
    expect($notification->data['kind'])->toBe('epk_published')
        ->and($notification->data['epk_title'])->toBe('Nova Ray EPK')
        ->and($notification->data['publisher_name'])->toBe($owner->name);

    // The person who clicked Publish doesn't get their own notification.
    expect($owner->fresh()->notifications()->count())->toBe(0);
});
