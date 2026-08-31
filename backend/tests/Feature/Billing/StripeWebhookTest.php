<?php

use App\Enums\SubscriptionPlan;
use App\Enums\SubscriptionStatus;
use App\Models\Workspace;
use Stripe\WebhookSignature;

function stripeSubscriptionPayload(array $overrides = []): string
{
    $subscription = array_replace([
        'id' => 'sub_test_123',
        'object' => 'subscription',
        'customer' => 'cus_test_123',
        'status' => 'active',
        'canceled_at' => null,
        'metadata' => ['workspace_id' => '1'],
        'items' => [
            'object' => 'list',
            'data' => [
                [
                    'id' => 'si_test_123',
                    'object' => 'subscription_item',
                    'current_period_end' => 1_800_000_000,
                    'price' => ['id' => 'price_test_pro', 'object' => 'price'],
                ],
            ],
        ],
    ], $overrides);

    return json_encode([
        'id' => 'evt_test_'.uniqid(),
        'object' => 'event',
        'type' => $overrides['_event_type'] ?? 'customer.subscription.updated',
        'data' => ['object' => $subscription],
    ]);
}

function signedStripeHeaders(string $payload): array
{
    return ['Stripe-Signature' => WebhookSignature::generateSignatureHeader($payload, config('services.stripe.webhook_secret'))];
}

it('rejects a webhook with an invalid signature', function () {
    $payload = stripeSubscriptionPayload();

    $this->postJson('/api/stripe/webhook', json_decode($payload, true), ['Stripe-Signature' => 't=1,v1=not-a-real-signature'])
        ->assertStatus(400);
});

it('syncs plan, status, and period end from a subscription.updated event', function () {
    // Workspace::booted() already auto-provisions a Free subscription row —
    // update it in place rather than inserting a second row, which would
    // violate the one-subscription-per-workspace unique constraint.
    $workspace = Workspace::factory()->create();
    $workspace->subscription()->update(['plan' => SubscriptionPlan::Free]);

    $payload = stripeSubscriptionPayload(['metadata' => ['workspace_id' => (string) $workspace->id]]);

    $this->call('POST', '/api/stripe/webhook', [], [], [], [
        'HTTP_Stripe-Signature' => signedStripeHeaders($payload)['Stripe-Signature'],
        'CONTENT_TYPE' => 'application/json',
    ], $payload)->assertOk();

    $subscription = $workspace->subscription()->first();
    expect($subscription->plan)->toBe(SubscriptionPlan::Pro)
        ->and($subscription->status)->toBe(SubscriptionStatus::Active)
        ->and($subscription->stripe_customer_id)->toBe('cus_test_123')
        ->and($subscription->stripe_subscription_id)->toBe('sub_test_123')
        ->and($subscription->current_period_ends_at)->not->toBeNull();
});

it('marks a subscription past_due from a payment failure status', function () {
    $workspace = Workspace::factory()->create();
    $workspace->subscription()->update(['plan' => SubscriptionPlan::Pro]);

    $payload = stripeSubscriptionPayload([
        'status' => 'past_due',
        'metadata' => ['workspace_id' => (string) $workspace->id],
    ]);

    $this->call('POST', '/api/stripe/webhook', [], [], [], [
        'HTTP_Stripe-Signature' => signedStripeHeaders($payload)['Stripe-Signature'],
        'CONTENT_TYPE' => 'application/json',
    ], $payload)->assertOk();

    expect($workspace->subscription()->first()->status)->toBe(SubscriptionStatus::PastDue);
});

it('reverts a workspace to the Free plan when its subscription is deleted', function () {
    $workspace = Workspace::factory()->create();
    $workspace->subscription()->update([
        'plan' => SubscriptionPlan::Business,
        'stripe_subscription_id' => 'sub_test_123',
    ]);

    $payload = stripeSubscriptionPayload([
        '_event_type' => 'customer.subscription.deleted',
        'metadata' => ['workspace_id' => (string) $workspace->id],
    ]);

    $this->call('POST', '/api/stripe/webhook', [], [], [], [
        'HTTP_Stripe-Signature' => signedStripeHeaders($payload)['Stripe-Signature'],
        'CONTENT_TYPE' => 'application/json',
    ], $payload)->assertOk();

    $subscription = $workspace->subscription()->first();
    expect($subscription->plan)->toBe(SubscriptionPlan::Free)
        ->and($subscription->status)->toBe(SubscriptionStatus::Canceled)
        ->and($subscription->stripe_subscription_id)->toBeNull()
        ->and($subscription->canceled_at)->not->toBeNull();
});

it('ignores an event for a workspace that no longer exists without erroring', function () {
    $payload = stripeSubscriptionPayload(['metadata' => ['workspace_id' => '999999']]);

    $this->call('POST', '/api/stripe/webhook', [], [], [], [
        'HTTP_Stripe-Signature' => signedStripeHeaders($payload)['Stripe-Signature'],
        'CONTENT_TYPE' => 'application/json',
    ], $payload)->assertOk();
});
