<?php

use App\Enums\SubscriptionPlan;
use App\Enums\WorkspaceRole;
use App\Models\User;
use App\Models\Workspace;

it('notifies existing members when someone accepts an invite and joins', function () {
    $owner = User::factory()->create();
    $existingMember = User::factory()->create();
    $workspace = Workspace::factory()->create(['created_by' => $owner->id]);
    $workspace->members()->create(['user_id' => $owner->id, 'role' => WorkspaceRole::Owner, 'status' => 'active', 'joined_at' => now()]);
    $workspace->members()->create(['user_id' => $existingMember->id, 'role' => WorkspaceRole::Viewer, 'status' => 'active', 'joined_at' => now()]);
    // Free's 2-member cap would otherwise block inviting a third person.
    $workspace->subscription()->update(['plan' => SubscriptionPlan::Business]);

    $invitee = User::factory()->create(['email' => 'invitee@example.com']);
    $this->actingAs($owner)->postJson("/api/workspaces/{$workspace->id}/members", [
        'email' => 'invitee@example.com',
        'role' => WorkspaceRole::Editor->value,
    ])->assertCreated();

    $token = $workspace->members()->whereNotNull('invite_token')->first()->invite_token;
    $this->actingAs($invitee)->postJson("/api/invitations/{$token}/accept")->assertOk();

    // Both the owner and the existing viewer get a "someone joined" bell —
    // neither of them is the one who just joined.
    expect($owner->fresh()->notifications()->where('data->kind', 'team_member_joined')->count())->toBe(1);
    expect($existingMember->fresh()->notifications()->where('data->kind', 'team_member_joined')->count())->toBe(1);

    $notification = $existingMember->fresh()->notifications()->where('data->kind', 'team_member_joined')->first();
    expect($notification->data['member_name'])->toBe($invitee->name)
        ->and($notification->data['member_role'])->toBe('editor');

    // The person who just joined doesn't get a "you joined" bell about
    // themselves.
    expect($invitee->fresh()->notifications()->where('data->kind', 'team_member_joined')->count())->toBe(0);
});
