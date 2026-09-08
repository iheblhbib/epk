<?php

use App\Enums\SubscriptionPlan;
use App\Enums\SubscriptionStatus;
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

    expect($this->limits->maxEpks($workspace))->toBe(1);
    expect($this->limits->maxTeamMembers($workspace))->toBe(2);
    expect($this->limits->maxArtists($workspace))->toBe(1);
    expect($this->limits->canUseCustomThemes($workspace))->toBeFalse();
    expect($this->limits->canUsePrivateLinks($workspace))->toBeFalse();
});

it('applies pro plan limits', function () {
    $workspace = Workspace::factory()->create();
    $workspace->subscription()->update(['plan' => SubscriptionPlan::Pro]);

    expect($this->limits->maxEpks($workspace))->toBe(5);
    expect($this->limits->maxTeamMembers($workspace))->toBe(10);
    expect($this->limits->maxArtists($workspace))->toBe(5);
});

it('treats a null limit as unlimited', function () {
    $workspace = Workspace::factory()->create();
    $workspace->subscription()->update(['plan' => SubscriptionPlan::Business]);

    expect($this->limits->maxEpks($workspace))->toBeNull();
    expect($this->limits->maxTeamMembers($workspace))->toBeNull();
    expect($this->limits->maxArtists($workspace))->toBeNull();
    expect($this->limits->remainingStorageBytes($workspace))->not->toBeNull(); // Business still caps storage
});

it('allows creating up to, but not at, the epk limit', function () {
    $workspace = Workspace::factory()->create();
    $workspace->subscription()->update(['plan' => SubscriptionPlan::Starter]); // max_epks = 1
    $artist = Artist::factory()->create(['workspace_id' => $workspace->id]);
    Epk::factory()->create(['workspace_id' => $workspace->id, 'artist_id' => $artist->id]);

    expect($this->limits->canCreateEpk($workspace))->toBeFalse();
});

it('allows creating up to, but not at, the artist limit', function () {
    $workspace = Workspace::factory()->create();
    $workspace->subscription()->update(['plan' => SubscriptionPlan::Starter]); // max_artists = 1

    expect($this->limits->canCreateArtist($workspace))->toBeTrue();

    Artist::factory()->create(['workspace_id' => $workspace->id]);

    expect($this->limits->canCreateArtist($workspace))->toBeFalse();
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

it('grants access for an active subscription or a trial still in the future', function () {
    $active = Workspace::factory()->create();
    $active->subscription()->update(['status' => SubscriptionStatus::Active, 'trial_ends_at' => null]);
    expect($this->limits->hasActiveAccess($active))->toBeTrue();

    $trialing = Workspace::factory()->create();
    $trialing->subscription()->update(['status' => SubscriptionStatus::Trialing, 'trial_ends_at' => now()->addDay()]);
    expect($this->limits->hasActiveAccess($trialing))->toBeTrue();
});

it('denies access for a canceled subscription or an expired trial', function () {
    $canceled = Workspace::factory()->create();
    $canceled->subscription()->update(['status' => SubscriptionStatus::Canceled, 'trial_ends_at' => null]);
    expect($this->limits->hasActiveAccess($canceled))->toBeFalse();

    $expiredTrial = Workspace::factory()->create();
    $expiredTrial->subscription()->update(['status' => SubscriptionStatus::Trialing, 'trial_ends_at' => now()->subDay()]);
    expect($this->limits->hasActiveAccess($expiredTrial))->toBeFalse();
});
