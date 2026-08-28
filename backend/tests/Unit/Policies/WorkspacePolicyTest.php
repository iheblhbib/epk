<?php

use App\Enums\WorkspaceRole;
use App\Models\User;
use App\Models\Workspace;
use App\Policies\WorkspacePolicy;

function memberWithRole(Workspace $workspace, WorkspaceRole $role): User
{
    $user = User::factory()->create();
    $workspace->members()->create(['user_id' => $user->id, 'role' => $role, 'status' => 'active', 'joined_at' => now()]);

    return $user;
}

beforeEach(function () {
    $this->policy = new WorkspacePolicy;
});

it('grants view to every active role, and denies non-members', function (WorkspaceRole $role) {
    $workspace = Workspace::factory()->create();
    $user = memberWithRole($workspace, $role);

    expect($this->policy->view($user, $workspace->fresh('members')))->toBeTrue();
})->with([
    WorkspaceRole::Owner, WorkspaceRole::Admin, WorkspaceRole::Editor, WorkspaceRole::Viewer,
]);

it('denies view to a non-member', function () {
    $workspace = Workspace::factory()->create();
    $stranger = User::factory()->create();

    expect($this->policy->view($stranger, $workspace->fresh('members')))->toBeFalse();
});

it('only grants update to owner and admin', function (WorkspaceRole $role, bool $expected) {
    $workspace = Workspace::factory()->create();
    $user = memberWithRole($workspace, $role);

    expect($this->policy->update($user, $workspace->fresh('members')))->toBe($expected);
})->with([
    'owner' => [WorkspaceRole::Owner, true],
    'admin' => [WorkspaceRole::Admin, true],
    'editor' => [WorkspaceRole::Editor, false],
    'viewer' => [WorkspaceRole::Viewer, false],
]);

it('only grants delete to owner', function (WorkspaceRole $role, bool $expected) {
    $workspace = Workspace::factory()->create();
    $user = memberWithRole($workspace, $role);

    expect($this->policy->delete($user, $workspace->fresh('members')))->toBe($expected);
})->with([
    'owner' => [WorkspaceRole::Owner, true],
    'admin' => [WorkspaceRole::Admin, false],
    'editor' => [WorkspaceRole::Editor, false],
    'viewer' => [WorkspaceRole::Viewer, false],
]);

it('only grants inviteMember to owner and admin', function (WorkspaceRole $role, bool $expected) {
    $workspace = Workspace::factory()->create();
    $user = memberWithRole($workspace, $role);

    expect($this->policy->inviteMember($user, $workspace->fresh('members')))->toBe($expected);
})->with([
    'owner' => [WorkspaceRole::Owner, true],
    'admin' => [WorkspaceRole::Admin, true],
    'editor' => [WorkspaceRole::Editor, false],
    'viewer' => [WorkspaceRole::Viewer, false],
]);

it('lets admins change editor/viewer roles but not owner/admin roles', function (WorkspaceRole $targetRole, bool $expected) {
    $workspace = Workspace::factory()->create();
    $admin = memberWithRole($workspace, WorkspaceRole::Admin);
    $target = memberWithRole($workspace, $targetRole);
    $targetMember = $workspace->members()->where('user_id', $target->id)->first();

    expect($this->policy->updateMemberRole($admin, $workspace->fresh('members'), $targetMember))->toBe($expected);
})->with([
    'target owner' => [WorkspaceRole::Owner, false],
    'target admin' => [WorkspaceRole::Admin, false],
    'target editor' => [WorkspaceRole::Editor, true],
    'target viewer' => [WorkspaceRole::Viewer, true],
]);

it('lets the owner change anyone\'s role', function (WorkspaceRole $targetRole) {
    $workspace = Workspace::factory()->create();
    $owner = memberWithRole($workspace, WorkspaceRole::Owner);
    $target = memberWithRole($workspace, $targetRole);
    $targetMember = $workspace->members()->where('user_id', $target->id)->first();

    expect($this->policy->updateMemberRole($owner, $workspace->fresh('members'), $targetMember))->toBeTrue();
})->with([
    WorkspaceRole::Admin, WorkspaceRole::Editor, WorkspaceRole::Viewer,
]);

it('never allows removing the last owner regardless of requester role', function () {
    $workspace = Workspace::factory()->create();
    $owner = memberWithRole($workspace, WorkspaceRole::Owner);
    $ownerMember = $workspace->members()->where('user_id', $owner->id)->first();

    expect($this->policy->removeMember($owner, $workspace->fresh('members'), $ownerMember))->toBeFalse();
});

it('allows removing an owner when another owner remains', function () {
    $workspace = Workspace::factory()->create();
    $ownerOne = memberWithRole($workspace, WorkspaceRole::Owner);
    $ownerTwo = memberWithRole($workspace, WorkspaceRole::Owner);
    $targetMember = $workspace->members()->where('user_id', $ownerTwo->id)->first();

    expect($this->policy->removeMember($ownerOne, $workspace->fresh('members'), $targetMember))->toBeTrue();
});

it('denies leave to the sole owner but allows it for other roles', function (WorkspaceRole $role, bool $expected) {
    $workspace = Workspace::factory()->create();
    $user = memberWithRole($workspace, $role);

    expect($this->policy->leave($user, $workspace->fresh('members')))->toBe($expected);
})->with([
    'sole owner' => [WorkspaceRole::Owner, false],
    'admin' => [WorkspaceRole::Admin, true],
    'editor' => [WorkspaceRole::Editor, true],
    'viewer' => [WorkspaceRole::Viewer, true],
]);
