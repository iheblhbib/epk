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

it('gives every new workspace a 14-day Starter-tier trial automatically', function () {
    [$workspace] = seederWorkspaceWithOwner();

    expect($workspace->subscription)->not->toBeNull();
    expect($workspace->subscription->plan)->toBe(SubscriptionPlan::Starter);
    expect($workspace->subscription->status)->toBe(SubscriptionStatus::Trialing);
    expect($workspace->subscription->trial_ends_at->diffInDays(now()))->toBeLessThanOrEqual(14)
        ->and($workspace->subscription->trial_ends_at->isFuture())->toBeTrue();
});

it('caps the trial at Starter-tier limits, not full access', function () {
    [$workspace, $owner] = seederWorkspaceWithOwner();
    $artist = Artist::factory()->create(['workspace_id' => $workspace->id]);
    Epk::factory()->create(['workspace_id' => $workspace->id, 'artist_id' => $artist->id]);

    // Starter allows one EPK -- the trial is a taste of the entry tier, not
    // unlimited access to whatever the workspace might eventually buy.
    $this->actingAs($owner)->postJson('/api/epks', [
        'workspace_id' => $workspace->id,
        'artist_id' => $artist->id,
        'title' => 'Second EPK, blocked on the Starter trial',
    ])->assertUnprocessable();
});
