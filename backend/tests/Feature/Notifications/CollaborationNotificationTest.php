<?php

use App\Enums\SubscriptionPlan;
use App\Enums\SubscriptionStatus;
use App\Enums\WorkspaceMemberStatus;
use App\Enums\WorkspaceRole;
use App\Models\User;
use App\Models\Workspace;
use App\Notifications\InvitationAcceptedNotification;
use App\Notifications\MemberRemovedNotification;
use App\Notifications\MemberRoleChangedNotification;
use App\Notifications\TeamMemberJoinedNotification;
use Illuminate\Support\Facades\Notification;

function collabWorkspace(): array
{
    $owner = User::factory()->create();
    $workspace = Workspace::factory()->create(['created_by' => $owner->id]);
    // Pro plan so team size isn't the constraint under test -- the Starter
    // trial caps a workspace at 2 members.
    $workspace->subscription()->update([
        'plan' => SubscriptionPlan::Pro,
        'status' => SubscriptionStatus::Active,
        'trial_ends_at' => null,
    ]);
    $workspace->members()->create(['user_id' => $owner->id, 'role' => WorkspaceRole::Owner, 'status' => 'active', 'joined_at' => now()]);

    return [$workspace, $owner];
}

it('emails and bell-notifies the inviter when their invitation is accepted', function () {
    Notification::fake();
    [$workspace, $owner] = collabWorkspace();
    $invitee = User::factory()->create(['email' => 'invitee@example.com']);

    $this->actingAs($owner)->postJson("/api/workspaces/{$workspace->id}/members", [
        'email' => 'invitee@example.com',
        'role' => WorkspaceRole::Editor->value,
    ]);
    $token = $workspace->members()->where('user_id', $invitee->id)->first()->invite_token;

    $this->actingAs($invitee)->postJson("/api/invitations/{$token}/accept")->assertOk();

    Notification::assertSentTo(
        $owner,
        InvitationAcceptedNotification::class,
        fn ($notification, $channels) => in_array('mail', $channels) && in_array('database', $channels)
    );
    // The inviter gets the specific "your invite was accepted" notification
    // instead of the generic broadcast, not both.
    Notification::assertNotSentTo($owner, TeamMemberJoinedNotification::class);
});

it('still broadcasts the generic team-joined notification to other members', function () {
    Notification::fake();
    [$workspace, $owner] = collabWorkspace();
    $other = User::factory()->create();
    $workspace->members()->create(['user_id' => $other->id, 'role' => WorkspaceRole::Admin, 'status' => 'active', 'joined_at' => now()]);
    $invitee = User::factory()->create(['email' => 'invitee@example.com']);

    $this->actingAs($owner)->postJson("/api/workspaces/{$workspace->id}/members", [
        'email' => 'invitee@example.com',
        'role' => WorkspaceRole::Editor->value,
    ]);
    $token = $workspace->members()->where('user_id', $invitee->id)->first()->invite_token;
    $this->actingAs($invitee)->postJson("/api/invitations/{$token}/accept")->assertOk();

    Notification::assertSentTo($other, TeamMemberJoinedNotification::class);
});

it('emails and bell-notifies a member when their role changes', function () {
    Notification::fake();
    [$workspace, $owner] = collabWorkspace();
    $editor = User::factory()->create();
    $member = $workspace->members()->create(['user_id' => $editor->id, 'role' => WorkspaceRole::Editor, 'status' => 'active', 'joined_at' => now()]);

    $this->actingAs($owner)
        ->putJson("/api/workspaces/{$workspace->id}/members/{$member->id}", ['role' => WorkspaceRole::Viewer->value])
        ->assertOk();

    Notification::assertSentTo(
        $editor,
        MemberRoleChangedNotification::class,
        fn ($notification, $channels) => $notification->newRole === WorkspaceRole::Viewer
            && in_array('mail', $channels)
            && in_array('database', $channels)
    );
});

it('emails a member when they are removed from a workspace', function () {
    Notification::fake();
    [$workspace, $owner] = collabWorkspace();
    $editor = User::factory()->create();
    $member = $workspace->members()->create(['user_id' => $editor->id, 'role' => WorkspaceRole::Editor, 'status' => 'active', 'joined_at' => now()]);

    $this->actingAs($owner)->deleteJson("/api/workspaces/{$workspace->id}/members/{$member->id}")->assertOk();

    Notification::assertSentTo(
        $editor,
        MemberRemovedNotification::class,
        fn ($notification, $channels) => $channels === ['mail']
    );
});

it('does not notify for role changes or removal of a still-pending invite', function () {
    Notification::fake();
    [$workspace, $owner] = collabWorkspace();
    $pending = $workspace->members()->create([
        'invited_email' => 'not-yet@example.com',
        'invited_by' => $owner->id,
        'invite_token' => str()->random(64),
        'role' => WorkspaceRole::Viewer,
        'status' => WorkspaceMemberStatus::Pending,
    ]);

    $this->actingAs($owner)
        ->putJson("/api/workspaces/{$workspace->id}/members/{$pending->id}", ['role' => WorkspaceRole::Editor->value])
        ->assertOk();
    $this->actingAs($owner)->deleteJson("/api/workspaces/{$workspace->id}/members/{$pending->id}")->assertOk();

    Notification::assertNotSentTo(new User(['id' => 0]), MemberRoleChangedNotification::class);
    Notification::assertNothingSentTo($owner);
});

it('respects a member opt-out of the role-change mail channel', function () {
    Notification::fake();
    [$workspace, $owner] = collabWorkspace();
    $editor = User::factory()->create(['notification_preferences' => ['member_role_changed' => ['mail' => false]]]);
    $member = $workspace->members()->create(['user_id' => $editor->id, 'role' => WorkspaceRole::Editor, 'status' => 'active', 'joined_at' => now()]);

    $this->actingAs($owner)
        ->putJson("/api/workspaces/{$workspace->id}/members/{$member->id}", ['role' => WorkspaceRole::Viewer->value])
        ->assertOk();

    Notification::assertSentTo(
        $editor,
        MemberRoleChangedNotification::class,
        fn ($notification, $channels) => $channels === ['database']
    );
});
