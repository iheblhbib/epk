<?php

use App\Enums\SubscriptionPlan;
use App\Enums\SubscriptionStatus;
use App\Enums\WorkspaceRole;
use App\Models\Artist;
use App\Models\Epk;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

function billingWorkspaceWithOwner(SubscriptionPlan $plan = SubscriptionPlan::Starter): array
{
    $owner = User::factory()->create();
    $workspace = Workspace::factory()->create(['created_by' => $owner->id]);
    $workspace->subscription()->update(['plan' => $plan, 'status' => SubscriptionStatus::Active, 'trial_ends_at' => null]);
    $workspace->members()->create(['user_id' => $owner->id, 'role' => WorkspaceRole::Owner, 'status' => 'active', 'joined_at' => now()]);

    return [$workspace, $owner];
}

it('exposes starter limits and two Stripe price ids per plan from config', function () {
    expect(config('plans.starter.max_epks'))->toBe(3);
    expect(config('plans.starter.max_storage_bytes'))->toBe(150 * 1024 * 1024);
    expect(config('plans.pro.max_storage_bytes'))->toBe(2 * 1024 * 1024 * 1024);
    expect(config('plans.business.max_storage_bytes'))->toBe(20 * 1024 * 1024 * 1024);
    expect(config('plans.starter'))->toHaveKeys(['stripe_price_id_monthly', 'stripe_price_id_yearly']);
    expect(config('plans'))->not->toHaveKey('free');
});

it('blocks creating a fourth epk on the starter plan (limit is 3)', function () {
    [$workspace, $owner] = billingWorkspaceWithOwner(SubscriptionPlan::Starter);
    $artist = Artist::factory()->create(['workspace_id' => $workspace->id]);
    Epk::factory()->count(3)->create(['workspace_id' => $workspace->id, 'artist_id' => $artist->id]);

    $this->actingAs($owner)->postJson('/api/epks', [
        'workspace_id' => $workspace->id,
        'artist_id' => $artist->id,
        'title' => 'One EPK Too Many',
    ])->assertUnprocessable();
});

it('allows a fourth epk once the workspace is on Pro', function () {
    [$workspace, $owner] = billingWorkspaceWithOwner(SubscriptionPlan::Pro);
    $artist = Artist::factory()->create(['workspace_id' => $workspace->id]);
    Epk::factory()->count(3)->create(['workspace_id' => $workspace->id, 'artist_id' => $artist->id]);

    $this->actingAs($owner)->postJson('/api/epks', [
        'workspace_id' => $workspace->id,
        'artist_id' => $artist->id,
        'title' => 'Fourth EPK',
    ])->assertCreated();
});

it('blocks duplicating an epk on the starter plan, same as creating one directly', function () {
    [$workspace, $owner] = billingWorkspaceWithOwner(SubscriptionPlan::Starter);
    $artist = Artist::factory()->create(['workspace_id' => $workspace->id]);
    Epk::factory()->count(2)->create(['workspace_id' => $workspace->id, 'artist_id' => $artist->id]);
    $epk = Epk::factory()->create(['workspace_id' => $workspace->id, 'artist_id' => $artist->id]);

    $this->actingAs($owner)->postJson("/api/epks/{$epk->id}/duplicate")->assertUnprocessable();
    expect($workspace->epks()->count())->toBe(3);
});

it('blocks custom theme overrides on the starter plan but still allows picking a preset', function () {
    [$workspace, $owner] = billingWorkspaceWithOwner(SubscriptionPlan::Starter);
    $artist = Artist::factory()->create(['workspace_id' => $workspace->id]);
    $epk = Epk::factory()->create(['workspace_id' => $workspace->id, 'artist_id' => $artist->id]);

    $this->actingAs($owner)->putJson("/api/epks/{$epk->id}", ['theme' => 'dark'])
        ->assertOk()
        ->assertJsonPath('data.theme', 'dark');

    $this->actingAs($owner)->putJson("/api/epks/{$epk->id}", [
        'custom_settings' => ['accent_color' => '#ff0000'],
    ])->assertUnprocessable();
});

it('blocks creating a private link on the starter plan', function () {
    [$workspace, $owner] = billingWorkspaceWithOwner(SubscriptionPlan::Starter);
    $artist = Artist::factory()->create(['workspace_id' => $workspace->id]);
    $epk = Epk::factory()->create(['workspace_id' => $workspace->id, 'artist_id' => $artist->id]);

    $this->actingAs($owner)->postJson("/api/epks/{$epk->id}/private-links", ['label' => 'For the label'])
        ->assertUnprocessable();
});

it('blocks inviting past the starter plan team member limit', function () {
    [$workspace, $owner] = billingWorkspaceWithOwner(SubscriptionPlan::Starter);
    $second = User::factory()->create();
    $workspace->members()->create(['user_id' => $second->id, 'role' => WorkspaceRole::Editor, 'status' => 'active', 'joined_at' => now()]);

    // Starter's max_team_members is 2, and the workspace already has 2.
    $this->actingAs($owner)->postJson("/api/workspaces/{$workspace->id}/members", [
        'email' => 'third@example.com',
        'role' => WorkspaceRole::Viewer->value,
    ])->assertUnprocessable();
});

it('blocks a media upload that would exceed the plan storage limit', function () {
    Storage::fake('public');
    config(['plans.starter.max_storage_bytes' => 1024]); // 1KB, smaller than any real fake image
    [$workspace, $owner] = billingWorkspaceWithOwner(SubscriptionPlan::Starter);

    $this->actingAs($owner)->postJson("/api/workspaces/{$workspace->id}/media", [
        'files' => [UploadedFile::fake()->image('cover.jpg', 200, 200)],
    ])->assertUnprocessable();
});

it('lets an admin change a workspace plan, unlocking that workspace\'s limits', function () {
    $admin = User::factory()->admin()->create();
    [$workspace] = billingWorkspaceWithOwner(SubscriptionPlan::Starter);

    $this->actingAs($admin)->patchJson("/api/admin/workspaces/{$workspace->id}/subscription", [
        'plan' => SubscriptionPlan::Business->value,
    ])->assertOk()->assertJsonPath('data.plan', SubscriptionPlan::Business->value);

    expect($workspace->subscription->fresh()->plan)->toBe(SubscriptionPlan::Business);
    $this->assertDatabaseHas('audit_logs', ['action' => 'workspace.plan_changed_by_admin', 'subject_id' => $workspace->id]);
});

it('unlocks a previously locked-out workspace when an admin overrides its plan', function () {
    $admin = User::factory()->admin()->create();
    [$workspace, $owner] = billingWorkspaceWithOwner(SubscriptionPlan::Starter);
    $workspace->subscription()->update(['status' => SubscriptionStatus::Canceled, 'trial_ends_at' => now()->subDay()]);

    // Confirm the workspace is genuinely locked out before the override.
    $this->actingAs($owner)->getJson("/api/workspaces/{$workspace->id}")->assertStatus(402);

    $this->actingAs($admin)->patchJson("/api/admin/workspaces/{$workspace->id}/subscription", [
        'plan' => SubscriptionPlan::Pro->value,
    ])->assertOk();

    $subscription = $workspace->subscription->fresh();
    expect($subscription->status)->toBe(SubscriptionStatus::Active)
        ->and($subscription->trial_ends_at)->toBeNull();

    // The access-gate middleware now lets the workspace through.
    $this->actingAs($owner)->getJson("/api/workspaces/{$workspace->id}")->assertOk();
});

it('returns plan, usage, and the plan comparison table from the billing endpoint', function () {
    [$workspace, $owner] = billingWorkspaceWithOwner(SubscriptionPlan::Starter);

    $response = $this->actingAs($owner)->getJson("/api/workspaces/{$workspace->id}/billing");

    $response->assertOk()
        ->assertJsonPath('data.plan', SubscriptionPlan::Starter->value)
        ->assertJsonPath('data.usage.epks.limit', 3)
        ->assertJsonStructure(['data' => ['plan', 'usage', 'plans' => ['starter', 'pro', 'business']]]);
});

it('returns plan business and subscription_status trialing for a fresh, never-subscribed workspace', function () {
    // Deliberately not using billingWorkspaceWithOwner() here -- that
    // helper immediately overwrites the subscription row to Active with no
    // trial. This test needs the real, untouched Workspace::booted() state:
    // every new workspace gets a 14-day trial at full Business-tier limits,
    // and BillingController::show() returns that `plan` column verbatim.
    // No test previously asserted this combination, which is exactly why a
    // trialing workspace being unable to check out into Business shipped
    // unnoticed on the frontend (BillingPage.tsx computed "is this my
    // current plan" from `plan` alone).
    $owner = User::factory()->create();
    $workspace = Workspace::factory()->create(['created_by' => $owner->id]);
    $workspace->members()->create(['user_id' => $owner->id, 'role' => WorkspaceRole::Owner, 'status' => 'active', 'joined_at' => now()]);

    $response = $this->actingAs($owner)->getJson("/api/workspaces/{$workspace->id}/billing");

    $response->assertOk()
        ->assertJsonPath('data.plan', SubscriptionPlan::Business->value)
        ->assertJsonPath('data.subscription_status', SubscriptionStatus::Trialing->value);
});
