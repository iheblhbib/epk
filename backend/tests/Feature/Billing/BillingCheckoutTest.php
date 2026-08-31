<?php

use App\Enums\SubscriptionPlan;
use App\Enums\WorkspaceRole;
use App\Models\User;
use App\Models\Workspace;
use App\Services\StripeBillingService;

function makeWorkspaceWithRoleForBilling(WorkspaceRole $role): array
{
    $owner = User::factory()->create();
    $workspace = Workspace::factory()->create(['created_by' => $owner->id]);
    $workspace->members()->create(['user_id' => $owner->id, 'role' => WorkspaceRole::Owner, 'status' => 'active', 'joined_at' => now()]);

    if ($role === WorkspaceRole::Owner) {
        return [$workspace, $owner];
    }

    $member = User::factory()->create();
    $workspace->members()->create(['user_id' => $member->id, 'role' => $role, 'status' => 'active', 'joined_at' => now()]);

    return [$workspace, $member];
}

it('creates a Stripe Checkout session for a valid plan', function () {
    [$workspace, $owner] = makeWorkspaceWithRoleForBilling(WorkspaceRole::Owner);

    $this->mock(StripeBillingService::class, function ($mock) {
        $mock->shouldReceive('createCheckoutSession')
            ->once()
            ->withArgs(fn ($ws, $plan) => $plan === SubscriptionPlan::Pro)
            ->andReturn('https://checkout.stripe.com/c/pay/fake_session');
    });

    $this->actingAs($owner)
        ->postJson("/api/workspaces/{$workspace->id}/billing/checkout", ['plan' => 'pro'])
        ->assertOk()
        ->assertJsonPath('data.url', 'https://checkout.stripe.com/c/pay/fake_session');
});

it('rejects an unknown plan for checkout', function () {
    [$workspace, $owner] = makeWorkspaceWithRoleForBilling(WorkspaceRole::Owner);

    $this->actingAs($owner)
        ->postJson("/api/workspaces/{$workspace->id}/billing/checkout", ['plan' => 'not-a-real-plan'])
        ->assertUnprocessable();
});

it('refuses checkout for a viewer (admin-level ability required)', function () {
    [$workspace, $viewer] = makeWorkspaceWithRoleForBilling(WorkspaceRole::Viewer);

    $this->actingAs($viewer)
        ->postJson("/api/workspaces/{$workspace->id}/billing/checkout", ['plan' => 'pro'])
        ->assertForbidden();
});

it('creates a Stripe Billing Portal session', function () {
    [$workspace, $owner] = makeWorkspaceWithRoleForBilling(WorkspaceRole::Owner);

    $this->mock(StripeBillingService::class, function ($mock) {
        $mock->shouldReceive('createPortalSession')
            ->once()
            ->andReturn('https://billing.stripe.com/p/session/fake');
    });

    $this->actingAs($owner)
        ->postJson("/api/workspaces/{$workspace->id}/billing/portal")
        ->assertOk()
        ->assertJsonPath('data.url', 'https://billing.stripe.com/p/session/fake');
});

it('surfaces a friendly error when the portal is requested with no Stripe customer yet', function () {
    [$workspace, $owner] = makeWorkspaceWithRoleForBilling(WorkspaceRole::Owner);

    $this->mock(StripeBillingService::class, function ($mock) {
        $mock->shouldReceive('createPortalSession')
            ->once()
            ->andThrow(new RuntimeException('This workspace has no billing account yet — subscribe to a paid plan first.'));
    });

    $this->actingAs($owner)
        ->postJson("/api/workspaces/{$workspace->id}/billing/portal")
        ->assertUnprocessable()
        ->assertJsonPath('errors.workspace.0', 'This workspace has no billing account yet — subscribe to a paid plan first.');
});
