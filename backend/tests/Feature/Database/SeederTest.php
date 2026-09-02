<?php

use App\Enums\SubscriptionPlan;
use App\Enums\SubscriptionStatus;
use App\Enums\WorkspaceRole;
use App\Models\Artist;
use App\Models\Epk;
use App\Models\User;
use App\Models\Workspace;

function seederWorkspaceWithOwner(): array
{
    $owner = User::factory()->create();
    $workspace = Workspace::factory()->create(['created_by' => $owner->id]);
    $workspace->members()->create(['user_id' => $owner->id, 'role' => WorkspaceRole::Owner, 'status' => 'active', 'joined_at' => now()]);

    return [$workspace, $owner];
}

it('gives every new workspace a 14-day full-access trial automatically', function () {
    [$workspace] = seederWorkspaceWithOwner();

    expect($workspace->subscription)->not->toBeNull();
    expect($workspace->subscription->plan)->toBe(SubscriptionPlan::Business);
    expect($workspace->subscription->status)->toBe(SubscriptionStatus::Trialing);
    expect($workspace->subscription->trial_ends_at->diffInDays(now()))->toBeLessThanOrEqual(14)
        ->and($workspace->subscription->trial_ends_at->isFuture())->toBeTrue();
});

it('grants full Business-tier limits during the trial regardless of eventual pack choice', function () {
    [$workspace, $owner] = seederWorkspaceWithOwner();
    $artist = Artist::factory()->create(['workspace_id' => $workspace->id]);
    Epk::factory()->count(5)->create(['workspace_id' => $workspace->id, 'artist_id' => $artist->id]);

    // Starter's own limit is 3 EPKs -- proves the trial isn't capped at
    // whatever tier the workspace might eventually subscribe to.
    $this->actingAs($owner)->postJson('/api/epks', [
        'workspace_id' => $workspace->id,
        'artist_id' => $artist->id,
        'title' => 'Sixth EPK, still fine during trial',
    ])->assertCreated();
});
