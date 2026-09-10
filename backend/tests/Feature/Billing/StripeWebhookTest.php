<?php

use App\Enums\SubscriptionPlan;
use App\Enums\SubscriptionStatus;
use App\Enums\WorkspaceRole;
use App\Models\User;
use App\Models\Workspace;
use App\Notifications\PaymentActionRequiredNotification;
use App\Notifications\PaymentFailedNotification;
use App\Notifications\SubscriptionActivatedNotification;
use App\Notifications\SubscriptionCanceledNotification;
use App\Notifications\SubscriptionCancelScheduledNotification;
use App\Notifications\SubscriptionSuspendedNotification;
use Illuminate\Support\Facades\Notification;
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
                    'price' => ['id' => 'price_test_pro_monthly', 'object' => 'price'],
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

it('syncs plan, interval, status, and period end from a subscription.updated event (monthly price)', function () {
    $workspace = Workspace::factory()->create();

    $payload = stripeSubscriptionPayload(['metadata' => ['workspace_id' => (string) $workspace->id]]);

    $this->call('POST', '/api/stripe/webhook', [], [], [], [
        'HTTP_Stripe-Signature' => signedStripeHeaders($payload)['Stripe-Signature'],
        'CONTENT_TYPE' => 'application/json',
    ], $payload)->assertOk();

    $subscription = $workspace->subscription()->first();
    expect($subscription->plan)->toBe(SubscriptionPlan::Pro)
        ->and($subscription->billing_interval)->toBe('monthly')
        ->and($subscription->status)->toBe(SubscriptionStatus::Active)
        ->and($subscription->stripe_customer_id)->toBe('cus_test_123')
        ->and($subscription->stripe_subscription_id)->toBe('sub_test_123')
        ->and($subscription->current_period_ends_at)->not->toBeNull();
});

it('resolves the yearly price id to the same plan with a yearly interval', function () {
    $workspace = Workspace::factory()->create();

    $payload = stripeSubscriptionPayload([
        'metadata' => ['workspace_id' => (string) $workspace->id],
        'items' => [
            'object' => 'list',
            'data' => [[
                'id' => 'si_test_123',
                'object' => 'subscription_item',
                'current_period_end' => 1_800_000_000,
                'price' => ['id' => 'price_test_pro_yearly', 'object' => 'price'],
            ]],
        ],
    ]);

    $this->call('POST', '/api/stripe/webhook', [], [], [], [
        'HTTP_Stripe-Signature' => signedStripeHeaders($payload)['Stripe-Signature'],
        'CONTENT_TYPE' => 'application/json',
    ], $payload)->assertOk();

    $subscription = $workspace->subscription()->first();
    expect($subscription->plan)->toBe(SubscriptionPlan::Pro)
        ->and($subscription->billing_interval)->toBe('yearly');
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

it('marks the subscription canceled (not reverted to any plan) when deleted on Stripe\'s side', function () {
    $workspace = Workspace::factory()->create();
    $workspace->subscription()->update([
        'plan' => SubscriptionPlan::Business,
        'status' => SubscriptionStatus::Active,
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
    // Plan is left as whatever it last was (Business here) -- irrelevant
    // once canceled, since the access-gate middleware blocks on status,
    // not plan. No more "revert to Free": there's nothing to revert to.
    expect($subscription->plan)->toBe(SubscriptionPlan::Business)
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

/** Owner + admin on a workspace, so subscription notifications have recipients. */
function webhookWorkspaceWithAdmins(SubscriptionStatus $status): Workspace
{
    $workspace = Workspace::factory()->create();
    $workspace->subscription()->update(['plan' => SubscriptionPlan::Pro, 'status' => $status]);
    foreach ([WorkspaceRole::Owner, WorkspaceRole::Admin] as $role) {
        $user = User::factory()->create();
        $workspace->members()->create(['user_id' => $user->id, 'role' => $role, 'status' => 'active', 'joined_at' => now()]);
    }

    return $workspace;
}

function postStripeWebhook(string $payload): void
{
    test()->call('POST', '/api/stripe/webhook', [], [], [], [
        'HTTP_Stripe-Signature' => signedStripeHeaders($payload)['Stripe-Signature'],
        'CONTENT_TYPE' => 'application/json',
    ], $payload)->assertOk();
}

it('marks a subscription unpaid and emails a suspension notice when Stripe exhausts retries', function () {
    Notification::fake();
    $workspace = webhookWorkspaceWithAdmins(SubscriptionStatus::PastDue);

    postStripeWebhook(stripeSubscriptionPayload([
        'status' => 'unpaid',
        'metadata' => ['workspace_id' => (string) $workspace->id],
    ]));

    expect($workspace->subscription()->first()->status)->toBe(SubscriptionStatus::Unpaid);
    Notification::assertSentTo($workspace->adminUsers(), SubscriptionSuspendedNotification::class);
});

it('emails owners and admins when a payment fails and the subscription goes past_due', function () {
    Notification::fake();
    $workspace = webhookWorkspaceWithAdmins(SubscriptionStatus::Active);

    postStripeWebhook(stripeSubscriptionPayload([
        'status' => 'past_due',
        'metadata' => ['workspace_id' => (string) $workspace->id],
    ]));

    Notification::assertSentTo(
        $workspace->adminUsers(),
        PaymentFailedNotification::class
    );
});

it('does not re-email on a repeat past_due webhook', function () {
    Notification::fake();
    $workspace = webhookWorkspaceWithAdmins(SubscriptionStatus::PastDue);

    postStripeWebhook(stripeSubscriptionPayload([
        'status' => 'past_due',
        'metadata' => ['workspace_id' => (string) $workspace->id],
    ]));

    Notification::assertNothingSent();
});

it('emails owners and admins when the subscription recovers to active', function () {
    Notification::fake();
    $workspace = webhookWorkspaceWithAdmins(SubscriptionStatus::PastDue);

    postStripeWebhook(stripeSubscriptionPayload([
        'status' => 'active',
        'metadata' => ['workspace_id' => (string) $workspace->id],
    ]));

    Notification::assertSentTo(
        $workspace->adminUsers(),
        SubscriptionActivatedNotification::class,
        fn ($notification) => $notification->recovered === true
    );
});

it('emails owners and admins when a trial converts to a paid subscription', function () {
    Notification::fake();
    $workspace = webhookWorkspaceWithAdmins(SubscriptionStatus::Trialing);

    postStripeWebhook(stripeSubscriptionPayload([
        'status' => 'active',
        'metadata' => ['workspace_id' => (string) $workspace->id],
    ]));

    Notification::assertSentTo(
        $workspace->adminUsers(),
        SubscriptionActivatedNotification::class,
        fn ($notification) => $notification->recovered === false
    );
});

it('records a scheduled cancellation and emails a heads-up once', function () {
    Notification::fake();
    $workspace = webhookWorkspaceWithAdmins(SubscriptionStatus::Active);
    $endsAt = 1_800_000_000;

    $payload = stripeSubscriptionPayload([
        'cancel_at_period_end' => true,
        'cancel_at' => $endsAt,
        'metadata' => ['workspace_id' => (string) $workspace->id],
    ]);
    postStripeWebhook($payload);

    $subscription = $workspace->subscription()->first();
    expect($subscription->status)->toBe(SubscriptionStatus::Active)
        ->and($subscription->cancels_at?->timestamp)->toBe($endsAt);
    Notification::assertSentToTimes(
        $workspace->adminUsers()->first(),
        SubscriptionCancelScheduledNotification::class,
        1
    );

    // A repeat webhook carrying the same scheduled cancellation doesn't re-email.
    postStripeWebhook($payload);
    Notification::assertSentToTimes(
        $workspace->adminUsers()->first(),
        SubscriptionCancelScheduledNotification::class,
        1
    );
});

it('clears the scheduled cancellation when the user reactivates', function () {
    Notification::fake();
    $workspace = webhookWorkspaceWithAdmins(SubscriptionStatus::Active);
    $workspace->subscription()->update(['cancels_at' => now()->addWeek()]);

    postStripeWebhook(stripeSubscriptionPayload([
        'cancel_at_period_end' => false,
        'cancel_at' => null,
        'metadata' => ['workspace_id' => (string) $workspace->id],
    ]));

    expect($workspace->subscription()->first()->cancels_at)->toBeNull();
});

it('emails a 3-D Secure confirmation link when a renewal needs authentication', function () {
    Notification::fake();
    $workspace = webhookWorkspaceWithAdmins(SubscriptionStatus::Active);
    $workspace->subscription()->update(['stripe_subscription_id' => 'sub_3ds']);

    $payload = json_encode([
        'id' => 'evt_'.uniqid(),
        'object' => 'event',
        'type' => 'invoice.payment_action_required',
        'data' => ['object' => [
            'id' => 'in_test',
            'object' => 'invoice',
            'subscription' => 'sub_3ds',
            'hosted_invoice_url' => 'https://invoice.stripe.test/i/abc123',
        ]],
    ]);
    postStripeWebhook($payload);

    Notification::assertSentTo(
        $workspace->adminUsers(),
        PaymentActionRequiredNotification::class
    );
});

it('emails owners and admins when the subscription is canceled on Stripe', function () {
    Notification::fake();
    $workspace = webhookWorkspaceWithAdmins(SubscriptionStatus::Active);
    $workspace->subscription()->update(['stripe_subscription_id' => 'sub_test_123']);

    postStripeWebhook(stripeSubscriptionPayload([
        '_event_type' => 'customer.subscription.deleted',
        'metadata' => ['workspace_id' => (string) $workspace->id],
    ]));

    Notification::assertSentTo(
        $workspace->adminUsers(),
        SubscriptionCanceledNotification::class
    );
});
