<?php

use App\Enums\WorkspaceRole;
use App\Models\Artist;
use App\Models\Epk;
use App\Models\EpkSection;
use App\Models\EpkSectionComment;
use App\Models\User;
use App\Models\Workspace;

function commentTestWorkspaceWithMember(WorkspaceRole $role): array
{
    $workspace = Workspace::factory()->create();
    $user = User::factory()->create();
    $workspace->members()->create(['user_id' => $user->id, 'role' => $role, 'status' => 'active', 'joined_at' => now()]);

    return [$workspace, $user];
}

function commentTestEpk(Workspace $workspace): Epk
{
    $artist = Artist::factory()->create(['workspace_id' => $workspace->id]);

    return Epk::factory()->create(['workspace_id' => $workspace->id, 'artist_id' => $artist->id]);
}

it('lists comments oldest first, with the author attached', function () {
    [$workspace, $viewer] = commentTestWorkspaceWithMember(WorkspaceRole::Viewer);
    $epk = commentTestEpk($workspace);
    $section = EpkSection::factory()->create(['epk_id' => $epk->id]);
    $author = User::factory()->create(['name' => 'Nova Ray']);
    $older = EpkSectionComment::factory()->create(['epk_section_id' => $section->id, 'user_id' => $author->id, 'created_at' => now()->subMinute()]);
    $newer = EpkSectionComment::factory()->create(['epk_section_id' => $section->id, 'created_at' => now()]);

    $response = $this->actingAs($viewer)
        ->getJson("/api/epks/{$epk->id}/sections/{$section->id}/comments")
        ->assertOk();

    $ids = collect($response->json('data'))->pluck('id')->values()->all();
    expect($ids)->toBe([$older->id, $newer->id]);
    expect($response->json('data.0.user.name'))->toBe('Nova Ray');
});

it('lets even a viewer-role member post a comment', function () {
    [$workspace, $viewer] = commentTestWorkspaceWithMember(WorkspaceRole::Viewer);
    $epk = commentTestEpk($workspace);
    $section = EpkSection::factory()->create(['epk_id' => $epk->id]);

    $response = $this->actingAs($viewer)
        ->postJson("/api/epks/{$epk->id}/sections/{$section->id}/comments", ['body' => 'Love the new hero image!']);

    $response->assertCreated();
    $response->assertJsonPath('data.body', 'Love the new hero image!');
    $response->assertJsonPath('data.user.id', $viewer->id);
    $this->assertDatabaseHas('epk_section_comments', ['epk_section_id' => $section->id, 'user_id' => $viewer->id]);
});

it('denies a non-member from viewing or posting comments', function () {
    $workspace = Workspace::factory()->create();
    $epk = commentTestEpk($workspace);
    $section = EpkSection::factory()->create(['epk_id' => $epk->id]);
    $outsider = User::factory()->create();

    $this->actingAs($outsider)
        ->getJson("/api/epks/{$epk->id}/sections/{$section->id}/comments")
        ->assertForbidden();

    $this->actingAs($outsider)
        ->postJson("/api/epks/{$epk->id}/sections/{$section->id}/comments", ['body' => 'Sneaking in'])
        ->assertForbidden();
});

it('lets the author edit their own comment but not anyone else', function () {
    [$workspace, $author] = commentTestWorkspaceWithMember(WorkspaceRole::Editor);
    $otherMember = User::factory()->create();
    $workspace->members()->create(['user_id' => $otherMember->id, 'role' => WorkspaceRole::Editor, 'status' => 'active', 'joined_at' => now()]);
    $epk = commentTestEpk($workspace);
    $section = EpkSection::factory()->create(['epk_id' => $epk->id]);
    $comment = EpkSectionComment::factory()->create(['epk_section_id' => $section->id, 'user_id' => $author->id, 'body' => 'Original']);

    $this->actingAs($otherMember)
        ->putJson("/api/epks/{$epk->id}/sections/{$section->id}/comments/{$comment->id}", ['body' => 'Hijacked'])
        ->assertForbidden();

    $this->actingAs($author)
        ->putJson("/api/epks/{$epk->id}/sections/{$section->id}/comments/{$comment->id}", ['body' => 'Edited'])
        ->assertOk()
        ->assertJsonPath('data.body', 'Edited');
});

it('lets the author delete their own comment', function () {
    [$workspace, $author] = commentTestWorkspaceWithMember(WorkspaceRole::Viewer);
    $epk = commentTestEpk($workspace);
    $section = EpkSection::factory()->create(['epk_id' => $epk->id]);
    $comment = EpkSectionComment::factory()->create(['epk_section_id' => $section->id, 'user_id' => $author->id]);

    $this->actingAs($author)
        ->deleteJson("/api/epks/{$epk->id}/sections/{$section->id}/comments/{$comment->id}")
        ->assertOk();

    $this->assertDatabaseMissing('epk_section_comments', ['id' => $comment->id]);
});

it('lets an admin-level teammate delete someone else\'s comment, but not a plain editor', function () {
    $workspace = Workspace::factory()->create();
    $owner = User::factory()->create();
    $admin = User::factory()->create();
    $editor = User::factory()->create();
    $author = User::factory()->create();
    $workspace->members()->create(['user_id' => $owner->id, 'role' => WorkspaceRole::Owner, 'status' => 'active', 'joined_at' => now()]);
    $workspace->members()->create(['user_id' => $admin->id, 'role' => WorkspaceRole::Admin, 'status' => 'active', 'joined_at' => now()]);
    $workspace->members()->create(['user_id' => $editor->id, 'role' => WorkspaceRole::Editor, 'status' => 'active', 'joined_at' => now()]);
    $workspace->members()->create(['user_id' => $author->id, 'role' => WorkspaceRole::Viewer, 'status' => 'active', 'joined_at' => now()]);
    $epk = commentTestEpk($workspace);
    $section = EpkSection::factory()->create(['epk_id' => $epk->id]);
    $comment = EpkSectionComment::factory()->create(['epk_section_id' => $section->id, 'user_id' => $author->id]);

    $this->actingAs($editor)
        ->deleteJson("/api/epks/{$epk->id}/sections/{$section->id}/comments/{$comment->id}")
        ->assertForbidden();

    $this->actingAs($admin)
        ->deleteJson("/api/epks/{$epk->id}/sections/{$section->id}/comments/{$comment->id}")
        ->assertOk();

    $this->assertDatabaseMissing('epk_section_comments', ['id' => $comment->id]);
});

it('404s a comment that belongs to a different section', function () {
    [$workspace, $editor] = commentTestWorkspaceWithMember(WorkspaceRole::Editor);
    $epk = commentTestEpk($workspace);
    $sectionA = EpkSection::factory()->create(['epk_id' => $epk->id]);
    $sectionB = EpkSection::factory()->create(['epk_id' => $epk->id]);
    $comment = EpkSectionComment::factory()->create(['epk_section_id' => $sectionA->id, 'user_id' => $editor->id]);

    $this->actingAs($editor)
        ->deleteJson("/api/epks/{$epk->id}/sections/{$sectionB->id}/comments/{$comment->id}")
        ->assertNotFound();
});
