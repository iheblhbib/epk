<?php

use App\Enums\SubscriptionStatus;
use App\Models\Workspace;
use App\Services\StripeBillingService;
use Stripe\Service\SubscriptionService;
use Stripe\StripeClient;
use Stripe\Subscription;

function linkedWorkspace(SubscriptionStatus $status, array $extra = []): Workspace
{
    $workspace = Workspace::factory()->create();
    $workspace->subscription()->update([
        'status' => $status,
        'trial_ends_at' => null,
        ...$extra,
    ]);

    return $workspace;
}

it('reconciles Stripe-linked subscriptions and skips pure trials', function () {
    $mock = Mockery::mock(StripeBillingService::class);
    $mock->shouldReceive('reconcile')->twice();
    $this->app->instance(StripeBillingService::class, $mock);

    linkedWorkspace(SubscriptionStatus::Active, ['stripe_subscription_id' => 'sub_1']);
    linkedWorkspace(SubscriptionStatus::PastDue, ['stripe_customer_id' => 'cus_2']);
    // A running trial: never touched Stripe, nothing to reconcile.
    Workspace::factory()->create();
    // Active but with no Stripe linkage at all: also skipped.
    linkedWorkspace(SubscriptionStatus::Active);

    $this->artisan('billing:reconcile')->assertExitCode(0);
});

it('keeps going when one subscription errors against Stripe', function () {
    $mock = Mockery::mock(StripeBillingService::class);
    $mock->shouldReceive('reconcile')->twice()
        ->andReturnUsing(function () {
            static $calls = 0;
            if (++$calls === 1) {
                throw new RuntimeException('stripe unreachable');
            }
        });
    $this->app->instance(StripeBillingService::class, $mock);

    linkedWorkspace(SubscriptionStatus::Active, ['stripe_subscription_id' => 'sub_a']);
    linkedWorkspace(SubscriptionStatus::Active, ['stripe_subscription_id' => 'sub_b']);

    $this->artisan('billing:reconcile')->assertExitCode(0);
});

it('pulls the live subscription from Stripe and applies its status', function () {
    $workspace = linkedWorkspace(SubscriptionStatus::Active, ['stripe_subscription_id' => 'sub_live']);

    $subService = Mockery::mock(SubscriptionService::class);
    $subService->shouldReceive('retrieve')->with('sub_live')->andReturn(Subscription::constructFrom([
        'id' => 'sub_live',
        'customer' => 'cus_x',
        'status' => 'canceled',
        'cancel_at_period_end' => false,
        'canceled_at' => now()->timestamp,
        'cancel_at' => null,
        'metadata' => ['workspace_id' => (string) $workspace->id],
        'items' => ['object' => 'list', 'data' => [[
            'current_period_end' => 1_800_000_000,
            'price' => ['id' => 'price_test_pro_monthly'],
        ]]],
    ]));

    // StripeClient::__get('subscriptions') delegates to getService(), which
    // is what's stubbed here — mocking __get itself on a Mockery mock is
    // unreliable.
    $client = Mockery::mock(StripeClient::class);
    $client->shouldReceive('getService')->with('subscriptions')->andReturn($subService);

    (new StripeBillingService($client))->reconcile($workspace->subscription->fresh());

    expect($workspace->subscription->fresh()->status)->toBe(SubscriptionStatus::Canceled);
});
