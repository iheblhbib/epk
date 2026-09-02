<?php

use App\Enums\SubscriptionPlan;
use App\Models\Artist;
use App\Models\Epk;
use App\Models\Workspace;
use App\Models\WorkspaceMember;
use App\Services\PlanLimits;

beforeEach(function () {
    $this->limits = new PlanLimits;
});

it('defaults to the starter plan when a subscription somehow has no plan set', function () {
    $workspace = Workspace::factory()->create();
    $workspace->subscription()->delete();

    expect($this->limits->plan($workspace->fresh()))->toBe(SubscriptionPlan::Starter);
});

it('applies starter plan limits', function () {
    $workspace = Workspace::factory()->create();
    $workspace->subscription()->update(['plan' => SubscriptionPlan::Starter]);

    expect($this->limits->maxEpks($workspace))->toBe(3);
    expect($this->limits->maxTeamMembers($workspace))->toBe(2);
    expect($this->limits->canUseCustomThemes($workspace))->toBeFalse();
    expect($this->limits->canUsePrivateLinks($workspace))->toBeFalse();
});

it('treats a null limit as unlimited', function () {
    $workspace = Workspace::factory()->create();
    $workspace->subscription()->update(['plan' => SubscriptionPlan::Business]);

    expect($this->limits->maxEpks($workspace))->toBeNull();
    expect($this->limits->maxTeamMembers($workspace))->toBeNull();
    expect($this->limits->remainingStorageBytes($workspace))->not->toBeNull(); // Business still caps storage
});

it('allows creating up to, but not at, the epk limit', function () {
    $workspace = Workspace::factory()->create();
    $workspace->subscription()->update(['plan' => SubscriptionPlan::Starter]); // max_epks = 3
    $artist = Artist::factory()->create(['workspace_id' => $workspace->id]);
    Epk::factory()->count(3)->create(['workspace_id' => $workspace->id, 'artist_id' => $artist->id]);

    expect($this->limits->canCreateEpk($workspace))->toBeFalse();
});

it('counts existing members (including the owner) toward the team member limit', function () {
    $workspace = Workspace::factory()->create();
    $workspace->subscription()->update(['plan' => SubscriptionPlan::Starter]); // max_team_members = 2
    $owner = WorkspaceMember::factory()->for($workspace)->create();

    expect($this->limits->canAddTeamMember($workspace))->toBeTrue();

    WorkspaceMember::factory()->for($workspace)->create();

    expect($this->limits->canAddTeamMember($workspace))->toBeFalse();
    expect($workspace->members()->count())->toBe(2);
    expect($owner->workspace_id)->toBe($workspace->id);
});

it('computes remaining storage and whether an upload fits', function () {
    $workspace = Workspace::factory()->create();
    $workspace->subscription()->update(['plan' => SubscriptionPlan::Starter]); // 150 MB
    expect($this->limits->remainingStorageBytes($workspace))->toBe(150 * 1024 * 1024);
    expect($this->limits->hasStorageFor($workspace, 100))->toBeTrue();
    expect($this->limits->hasStorageFor($workspace, 150 * 1024 * 1024 + 1))->toBeFalse();
});
