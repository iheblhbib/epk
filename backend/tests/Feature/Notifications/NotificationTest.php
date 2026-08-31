<?php

use App\Enums\WorkspaceRole;
use App\Models\User;
use App\Models\Workspace;
use App\Notifications\WorkspaceInvitationNotification;
use Illuminate\Notifications\DatabaseNotification;
use Illuminate\Support\Facades\Notification;

function makeWorkspaceWithOwnerForNotifications(): array
{
    $owner = User::factory()->create();
    $workspace = Workspace::factory()->create(['created_by' => $owner->id]);
    $workspace->members()->create(['user_id' => $owner->id, 'role' => WorkspaceRole::Owner, 'status' => 'active', 'joined_at' => now()]);

    return [$workspace, $owner];
}

it('notifies an existing invited user in-app, in addition to email', function () {
    Notification::fake();
    [$workspace, $owner] = makeWorkspaceWithOwnerForNotifications();
    $invitee = User::factory()->create(['email' => 'invitee@example.com']);

    $this->actingAs($owner)->postJson("/api/workspaces/{$workspace->id}/members", [
        'email' => 'invitee@example.com',
        'role' => WorkspaceRole::Editor->value,
    ])->assertCreated();

    Notification::assertSentTo(
        $invitee,
        WorkspaceInvitationNotification::class,
        fn ($notification, $channels) => in_array('database', $channels, true) && in_array('mail', $channels, true)
    );
});

it('stores a real database notification with the invite payload for an existing user', function () {
    [$workspace, $owner] = makeWorkspaceWithOwnerForNotifications();
    $invitee = User::factory()->create(['email' => 'invitee@example.com']);

    $this->actingAs($owner)->postJson("/api/workspaces/{$workspace->id}/members", [
        'email' => 'invitee@example.com',
        'role' => WorkspaceRole::Editor->value,
    ])->assertCreated();

    expect($invitee->notifications()->count())->toBe(1);

    $notification = $invitee->notifications()->first();
    expect($notification->data['kind'])->toBe('workspace_invitation')
        ->and($notification->data['workspace_name'])->toBe($workspace->name)
        ->and($notification->data['role'])->toBe('editor')
        ->and($notification->data['inviter_name'])->toBe($owner->name)
        ->and($notification->read_at)->toBeNull();
});

it('does not create a database notification when inviting someone with no account yet', function () {
    [$workspace, $owner] = makeWorkspaceWithOwnerForNotifications();

    $this->actingAs($owner)->postJson("/api/workspaces/{$workspace->id}/members", [
        'email' => 'not-yet-registered@example.com',
        'role' => WorkspaceRole::Viewer->value,
    ])->assertCreated();

    expect(DatabaseNotification::count())->toBe(0);
});

it("lists only the authenticated user's own notifications", function () {
    [$workspace, $owner] = makeWorkspaceWithOwnerForNotifications();
    $invitee = User::factory()->create(['email' => 'invitee@example.com']);
    $stranger = User::factory()->create();

    $this->actingAs($owner)->postJson("/api/workspaces/{$workspace->id}/members", [
        'email' => 'invitee@example.com',
        'role' => WorkspaceRole::Editor->value,
    ])->assertCreated();

    $this->actingAs($invitee)->getJson('/api/notifications')
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.kind', 'workspace_invitation');

    $this->actingAs($stranger)->getJson('/api/notifications')
        ->assertOk()
        ->assertJsonCount(0, 'data');
});

it('reports the correct unread count', function () {
    [$workspace, $owner] = makeWorkspaceWithOwnerForNotifications();
    $invitee = User::factory()->create(['email' => 'invitee@example.com']);

    $this->actingAs($owner)->postJson("/api/workspaces/{$workspace->id}/members", [
        'email' => 'invitee@example.com',
        'role' => WorkspaceRole::Editor->value,
    ])->assertCreated();

    $this->actingAs($invitee)->getJson('/api/notifications/unread-count')
        ->assertOk()
        ->assertJson(['count' => 1]);
});

it('marks a single notification as read, scoped to its owner', function () {
    [$workspace, $owner] = makeWorkspaceWithOwnerForNotifications();
    $invitee = User::factory()->create(['email' => 'invitee@example.com']);
    $stranger = User::factory()->create();

    $this->actingAs($owner)->postJson("/api/workspaces/{$workspace->id}/members", [
        'email' => 'invitee@example.com',
        'role' => WorkspaceRole::Editor->value,
    ])->assertCreated();

    $notificationId = $invitee->notifications()->first()->id;

    // A stranger can't mark someone else's notification as read — the
    // route is scoped through $request->user()->notifications(), so this
    // id simply doesn't exist in the stranger's own relation.
    $this->actingAs($stranger)->postJson("/api/notifications/{$notificationId}/read")
        ->assertNotFound();

    $response = $this->actingAs($invitee)->postJson("/api/notifications/{$notificationId}/read")
        ->assertOk();

    expect($response->json('data.read_at'))->not->toBeNull();

    $this->actingAs($invitee)->getJson('/api/notifications/unread-count')
        ->assertJson(['count' => 0]);
});

it('marks all notifications as read', function () {
    [$workspaceA, $owner] = makeWorkspaceWithOwnerForNotifications();
    $workspaceB = Workspace::factory()->create(['created_by' => $owner->id]);
    $workspaceB->members()->create(['user_id' => $owner->id, 'role' => WorkspaceRole::Owner, 'status' => 'active', 'joined_at' => now()]);
    $invitee = User::factory()->create(['email' => 'invitee@example.com']);

    $this->actingAs($owner)->postJson("/api/workspaces/{$workspaceA->id}/members", [
        'email' => 'invitee@example.com',
        'role' => WorkspaceRole::Editor->value,
    ])->assertCreated();
    $this->actingAs($owner)->postJson("/api/workspaces/{$workspaceB->id}/members", [
        'email' => 'invitee@example.com',
        'role' => WorkspaceRole::Viewer->value,
    ])->assertCreated();

    $this->actingAs($invitee)->getJson('/api/notifications/unread-count')->assertJson(['count' => 2]);

    $this->actingAs($invitee)->postJson('/api/notifications/mark-all-read')->assertOk();

    $this->actingAs($invitee)->getJson('/api/notifications/unread-count')->assertJson(['count' => 0]);
});

it('automatically marks the invite notification as read once accepted', function () {
    [$workspace, $owner] = makeWorkspaceWithOwnerForNotifications();
    $invitee = User::factory()->create(['email' => 'invitee@example.com']);

    $this->actingAs($owner)->postJson("/api/workspaces/{$workspace->id}/members", [
        'email' => 'invitee@example.com',
        'role' => WorkspaceRole::Editor->value,
    ])->assertCreated();

    $token = $workspace->members()->whereNotNull('invite_token')->first()->invite_token;

    $this->actingAs($invitee)->postJson("/api/invitations/{$token}/accept")->assertOk();

    $this->actingAs($invitee)->getJson('/api/notifications/unread-count')->assertJson(['count' => 0]);
});
