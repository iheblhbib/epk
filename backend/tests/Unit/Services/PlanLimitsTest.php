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

it('defaults to the free plan for a fresh workspace', function () {
    $workspace = Workspace::factory()->create();

    expect($this->limits->plan($workspace))->toBe(SubscriptionPlan::Free);
    expect($this->limits->maxEpks($workspace))->toBe(1);
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
    $workspace = Workspace::factory()->create(); // free: max_epks = 1
    expect($this->limits->canCreateEpk($workspace))->toBeTrue();

    $artist = Artist::factory()->create(['workspace_id' => $workspace->id]);
    Epk::factory()->create(['workspace_id' => $workspace->id, 'artist_id' => $artist->id]);

    expect($this->limits->canCreateEpk($workspace))->toBeFalse();
});

it('counts existing members (including the owner) toward the team member limit', function () {
    $workspace = Workspace::factory()->create(); // free: max_team_members = 2
    $owner = WorkspaceMember::factory()->for($workspace)->create();

    expect($this->limits->canAddTeamMember($workspace))->toBeTrue();

    WorkspaceMember::factory()->for($workspace)->create();

    expect($this->limits->canAddTeamMember($workspace))->toBeFalse();

    // Sanity: two members were actually created against this workspace.
    expect($workspace->members()->count())->toBe(2);
    expect($owner->workspace_id)->toBe($workspace->id);
});

it('computes remaining storage and whether an upload fits', function () {
    $workspace = Workspace::factory()->create();
    // Free plan: 500MB. No media uploaded yet.
    expect($this->limits->remainingStorageBytes($workspace))->toBe(500 * 1024 * 1024);
    expect($this->limits->hasStorageFor($workspace, 100))->toBeTrue();
    expect($this->limits->hasStorageFor($workspace, 500 * 1024 * 1024 + 1))->toBeFalse();
});
