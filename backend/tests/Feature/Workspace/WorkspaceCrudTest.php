<?php

use App\Enums\WorkspaceRole;
use App\Models\User;
use App\Models\Workspace;

it('creates a workspace and assigns the creator as owner', function () {
    $user = User::factory()->create();

    $response = $this->actingAs($user)->postJson('/api/workspaces', [
        'name' => 'Acme Records',
    ]);

    $response->assertCreated()->assertJsonPath('data.name', 'Acme Records');
    $response->assertJsonPath('data.my_role', WorkspaceRole::Owner->value);

    $workspace = Workspace::firstWhere('name', 'Acme Records');
    expect($workspace->members()->where('user_id', $user->id)->first()->role)
        ->toBe(WorkspaceRole::Owner);
});

it('only lists workspaces the user is an active member of', function () {
    $user = User::factory()->create();
    $myWorkspace = Workspace::factory()->create();
    $myWorkspace->members()->create(['user_id' => $user->id, 'role' => WorkspaceRole::Owner, 'status' => 'active', 'joined_at' => now()]);

    $otherWorkspace = Workspace::factory()->create();
    $otherWorkspace->members()->create(['user_id' => User::factory()->create()->id, 'role' => WorkspaceRole::Owner, 'status' => 'active', 'joined_at' => now()]);

    $response = $this->actingAs($user)->getJson('/api/workspaces');

    $response->assertOk();
    $ids = collect($response->json('data'))->pluck('id');

    expect($ids)->toContain($myWorkspace->id)->not->toContain($otherWorkspace->id);
});

it('enforces the update/delete permission matrix', function () {
    $workspace = Workspace::factory()->create();

    $owner = User::factory()->create();
    $admin = User::factory()->create();
    $editor = User::factory()->create();
    $viewer = User::factory()->create();

    $workspace->members()->create(['user_id' => $owner->id, 'role' => WorkspaceRole::Owner, 'status' => 'active', 'joined_at' => now()]);
    $workspace->members()->create(['user_id' => $admin->id, 'role' => WorkspaceRole::Admin, 'status' => 'active', 'joined_at' => now()]);
    $workspace->members()->create(['user_id' => $editor->id, 'role' => WorkspaceRole::Editor, 'status' => 'active', 'joined_at' => now()]);
    $workspace->members()->create(['user_id' => $viewer->id, 'role' => WorkspaceRole::Viewer, 'status' => 'active', 'joined_at' => now()]);

    $this->actingAs($editor)->putJson("/api/workspaces/{$workspace->id}", ['name' => 'Nope'])->assertForbidden();
    $this->actingAs($viewer)->putJson("/api/workspaces/{$workspace->id}", ['name' => 'Nope'])->assertForbidden();
    $this->actingAs($admin)->putJson("/api/workspaces/{$workspace->id}", ['name' => 'Updated'])->assertOk();

    $this->actingAs($admin)->deleteJson("/api/workspaces/{$workspace->id}")->assertForbidden();
    $this->actingAs($owner)->deleteJson("/api/workspaces/{$workspace->id}")->assertOk();

    $this->assertSoftDeleted('workspaces', ['id' => $workspace->id]);
});
