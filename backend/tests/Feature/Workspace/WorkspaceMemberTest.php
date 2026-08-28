<?php

use App\Enums\WorkspaceMemberStatus;
use App\Enums\WorkspaceRole;
use App\Models\User;
use App\Models\Workspace;
use App\Notifications\WorkspaceInvitationNotification;
use Illuminate\Support\Facades\Notification;

function makeWorkspaceWithOwner(): array
{
    $owner = User::factory()->create();
    $workspace = Workspace::factory()->create(['created_by' => $owner->id]);
    $workspace->members()->create(['user_id' => $owner->id, 'role' => WorkspaceRole::Owner, 'status' => 'active', 'joined_at' => now()]);

    return [$workspace, $owner];
}

it('invites an existing registered user as a pending member', function () {
    [$workspace, $owner] = makeWorkspaceWithOwner();
    $invitee = User::factory()->create(['email' => 'invitee@example.com']);

    $response = $this->actingAs($owner)->postJson("/api/workspaces/{$workspace->id}/members", [
        'email' => 'invitee@example.com',
        'role' => WorkspaceRole::Editor->value,
    ]);

    $response->assertCreated();
    $this->assertDatabaseHas('workspace_members', [
        'workspace_id' => $workspace->id,
        'user_id' => $invitee->id,
        'status' => WorkspaceMemberStatus::Pending->value,
        'role' => WorkspaceRole::Editor->value,
    ]);
});

it('invites an unregistered email as a pending row without a user_id', function () {
    [$workspace, $owner] = makeWorkspaceWithOwner();

    $this->actingAs($owner)->postJson("/api/workspaces/{$workspace->id}/members", [
        'email' => 'not-yet-registered@example.com',
        'role' => WorkspaceRole::Viewer->value,
    ])->assertCreated();

    $this->assertDatabaseHas('workspace_members', [
        'workspace_id' => $workspace->id,
        'user_id' => null,
        'invited_email' => 'not-yet-registered@example.com',
        'status' => WorkspaceMemberStatus::Pending->value,
    ]);
});

it('emails the invitation link to the invited address', function () {
    Notification::fake();
    [$workspace, $owner] = makeWorkspaceWithOwner();

    $this->actingAs($owner)->postJson("/api/workspaces/{$workspace->id}/members", [
        'email' => 'invitee@example.com',
        'role' => WorkspaceRole::Editor->value,
    ])->assertCreated();

    Notification::assertSentOnDemand(
        WorkspaceInvitationNotification::class,
        fn ($notification, $channels, $notifiable) => $notifiable->routes['mail'] === 'invitee@example.com'
    );
});

it('lets anyone with the token preview an invitation, without being logged in', function () {
    [$workspace, $owner] = makeWorkspaceWithOwner();
    $invitee = User::factory()->create(['email' => 'invitee@example.com']);

    $this->actingAs($owner)->postJson("/api/workspaces/{$workspace->id}/members", [
        'email' => 'invitee@example.com',
        'role' => WorkspaceRole::Editor->value,
    ]);

    $token = $workspace->members()->where('user_id', $invitee->id)->first()->invite_token;

    // Deliberately not actingAs() anyone — the token itself is the access
    // control (see WorkspaceInvitationController), the same way a
    // Slack/Notion-style invite link works.
    $this->getJson("/api/invitations/{$token}")
        ->assertOk()
        ->assertJsonPath('data.workspace.name', $workspace->name)
        ->assertJsonPath('data.role', WorkspaceRole::Editor->value)
        ->assertJsonPath('data.invited_by', $owner->name)
        ->assertJsonPath('data.invited_email', 'invitee@example.com')
        ->assertJsonPath('data.has_account', true);
});

it('flags has_account false for an invite addressed to an email with no account yet', function () {
    [$workspace, $owner] = makeWorkspaceWithOwner();

    $this->actingAs($owner)->postJson("/api/workspaces/{$workspace->id}/members", [
        'email' => 'brand-new@example.com',
        'role' => WorkspaceRole::Viewer->value,
    ]);

    $token = $workspace->members()->where('invited_email', 'brand-new@example.com')->first()->invite_token;

    $this->getJson("/api/invitations/{$token}")->assertOk()->assertJsonPath('data.has_account', false);
});

it('rejects accepting an invitation as a different account than it was addressed to', function () {
    [$workspace, $owner] = makeWorkspaceWithOwner();
    $invitee = User::factory()->create(['email' => 'invitee@example.com']);
    $stranger = User::factory()->create();

    $this->actingAs($owner)->postJson("/api/workspaces/{$workspace->id}/members", [
        'email' => 'invitee@example.com',
        'role' => WorkspaceRole::Editor->value,
    ]);

    $token = $workspace->members()->where('user_id', $invitee->id)->first()->invite_token;

    $this->actingAs($stranger)->postJson("/api/invitations/{$token}/accept")->assertUnprocessable();
});

it('registers a brand-new account and accepts the invitation in one step', function () {
    [$workspace, $owner] = makeWorkspaceWithOwner();

    // Created directly (not through an actingAs($owner) HTTP call) so this
    // test genuinely starts from a guest request, matching how a real
    // visitor arrives at this endpoint — nobody else logged in first.
    $token = str()->random(64);
    $workspace->members()->create([
        'invited_email' => 'new-teammate@example.com',
        'invited_by' => $owner->id,
        'invite_token' => $token,
        'role' => WorkspaceRole::Viewer,
        'status' => WorkspaceMemberStatus::Pending,
    ]);

    $response = $this->postJson("/api/invitations/{$token}/register", [
        'name' => 'New Teammate',
        'password' => 'Str0ng!Passw0rd',
        'password_confirmation' => 'Str0ng!Passw0rd',
    ]);

    $response->assertCreated()->assertJsonPath('data.status', WorkspaceMemberStatus::Active->value);

    $this->assertDatabaseHas('users', ['email' => 'new-teammate@example.com']);
    $newUser = User::where('email', 'new-teammate@example.com')->firstOrFail();
    expect($newUser->email_verified_at)->not->toBeNull();

    // The register call also logged them in.
    $this->assertAuthenticatedAs($newUser);
});

it('refuses to register-and-accept when an account already exists for that email', function () {
    [$workspace, $owner] = makeWorkspaceWithOwner();
    User::factory()->create(['email' => 'invitee@example.com']);

    $this->actingAs($owner)->postJson("/api/workspaces/{$workspace->id}/members", [
        'email' => 'invitee@example.com',
        'role' => WorkspaceRole::Editor->value,
    ]);

    $token = $workspace->members()->where('invited_email', 'invitee@example.com')->first()->invite_token;

    $this->postJson("/api/invitations/{$token}/register", [
        'name' => 'Someone',
        'password' => 'Str0ng!Passw0rd',
        'password_confirmation' => 'Str0ng!Passw0rd',
    ])->assertUnprocessable();
});

it('logs in as an existing account and accepts the invitation in one step', function () {
    [$workspace, $owner] = makeWorkspaceWithOwner();
    $invitee = User::factory()->create(['email' => 'invitee@example.com', 'password' => bcrypt('correct-password')]);

    // Created directly, not via actingAs($owner) — a genuine guest request.
    $token = str()->random(64);
    $workspace->members()->create([
        'user_id' => $invitee->id,
        'invited_email' => 'invitee@example.com',
        'invited_by' => $owner->id,
        'invite_token' => $token,
        'role' => WorkspaceRole::Editor,
        'status' => WorkspaceMemberStatus::Pending,
    ]);

    $response = $this->postJson("/api/invitations/{$token}/login", ['password' => 'correct-password']);

    $response->assertOk()->assertJsonPath('data.status', WorkspaceMemberStatus::Active->value);
    $this->assertAuthenticatedAs($invitee);
});

it('rejects the wrong password on the invitation login step', function () {
    [$workspace, $owner] = makeWorkspaceWithOwner();
    $invitee = User::factory()->create(['email' => 'invitee@example.com', 'password' => bcrypt('correct-password')]);

    $token = str()->random(64);
    $workspace->members()->create([
        'user_id' => $invitee->id,
        'invited_email' => 'invitee@example.com',
        'invited_by' => $owner->id,
        'invite_token' => $token,
        'role' => WorkspaceRole::Editor,
        'status' => WorkspaceMemberStatus::Pending,
    ]);

    $this->postJson("/api/invitations/{$token}/login", ['password' => 'wrong-password'])->assertUnprocessable();
    $this->assertGuest();
});

it('lets an invitee accept their invitation', function () {
    [$workspace, $owner] = makeWorkspaceWithOwner();
    $invitee = User::factory()->create(['email' => 'invitee@example.com']);

    $this->actingAs($owner)->postJson("/api/workspaces/{$workspace->id}/members", [
        'email' => 'invitee@example.com',
        'role' => WorkspaceRole::Editor->value,
    ]);

    $token = $workspace->members()->where('user_id', $invitee->id)->first()->invite_token;

    $this->actingAs($invitee)->postJson("/api/invitations/{$token}/accept")
        ->assertOk()
        ->assertJsonPath('data.status', WorkspaceMemberStatus::Active->value);
});

it('enforces the member role-change and removal matrix', function () {
    [$workspace, $owner] = makeWorkspaceWithOwner();
    $admin = User::factory()->create();
    $editor = User::factory()->create();

    $adminMember = $workspace->members()->create(['user_id' => $admin->id, 'role' => WorkspaceRole::Admin, 'status' => 'active', 'joined_at' => now()]);
    $editorMember = $workspace->members()->create(['user_id' => $editor->id, 'role' => WorkspaceRole::Editor, 'status' => 'active', 'joined_at' => now()]);

    // Admin cannot change another admin's role, but can change an editor's.
    $this->actingAs($admin)
        ->putJson("/api/workspaces/{$workspace->id}/members/{$adminMember->id}", ['role' => WorkspaceRole::Viewer->value])
        ->assertForbidden();

    $this->actingAs($admin)
        ->putJson("/api/workspaces/{$workspace->id}/members/{$editorMember->id}", ['role' => WorkspaceRole::Viewer->value])
        ->assertOk();

    // Owner can change anyone, including the admin.
    $this->actingAs($owner)
        ->putJson("/api/workspaces/{$workspace->id}/members/{$adminMember->id}", ['role' => WorkspaceRole::Editor->value])
        ->assertOk();

    // Admin cannot remove another admin-level member.
    $this->actingAs($admin)
        ->deleteJson("/api/workspaces/{$workspace->id}/members/{$adminMember->id}")
        ->assertForbidden();

    // Owner can remove a non-owner member.
    $this->actingAs($owner)
        ->deleteJson("/api/workspaces/{$workspace->id}/members/{$editorMember->id}")
        ->assertOk();

    $this->assertDatabaseMissing('workspace_members', ['id' => $editorMember->id]);
});

it('never allows removing the last remaining owner', function () {
    [$workspace, $owner] = makeWorkspaceWithOwner();
    $ownerMember = $workspace->members()->where('user_id', $owner->id)->first();

    $this->actingAs($owner)
        ->deleteJson("/api/workspaces/{$workspace->id}/members/{$ownerMember->id}")
        ->assertForbidden();
});

it('lets a member leave a workspace unless they are the sole owner', function () {
    [$workspace, $owner] = makeWorkspaceWithOwner();

    $this->actingAs($owner)
        ->postJson("/api/workspaces/{$workspace->id}/leave")
        ->assertForbidden();

    $editor = User::factory()->create();
    $workspace->members()->create(['user_id' => $editor->id, 'role' => WorkspaceRole::Editor, 'status' => 'active', 'joined_at' => now()]);

    $this->actingAs($editor)
        ->postJson("/api/workspaces/{$workspace->id}/leave")
        ->assertOk();

    $this->assertDatabaseMissing('workspace_members', ['workspace_id' => $workspace->id, 'user_id' => $editor->id]);
});
