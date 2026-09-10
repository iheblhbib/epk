<?php

use App\Enums\SubscriptionPlan;
use App\Enums\SubscriptionStatus;
use App\Enums\WorkspaceRole;
use App\Models\User;
use App\Models\Workspace;
use App\Notifications\AnnualRenewalReminderNotification;
use Illuminate\Support\Facades\Notification;

function annualWorkspace(array $subscription = []): array
{
    $owner = User::factory()->create();
    $admin = User::factory()->create();
    $workspace = Workspace::factory()->create(['created_by' => $owner->id]);
    $workspace->subscription()->update([
        'status' => SubscriptionStatus::Active,
        'plan' => SubscriptionPlan::Pro,
        'billing_interval' => 'yearly',
        'trial_ends_at' => null,
        'current_period_ends_at' => now()->addDays(5),
        ...$subscription,
    ]);
    $workspace->members()->create(['user_id' => $owner->id, 'role' => WorkspaceRole::Owner, 'status' => 'active', 'joined_at' => now()]);
    $workspace->members()->create(['user_id' => $admin->id, 'role' => WorkspaceRole::Admin, 'status' => 'active', 'joined_at' => now()]);

    return [$workspace, $owner, $admin];
}

it('reminds owners and admins about an upcoming annual renewal', function () {
    Notification::fake();
    [$workspace, $owner, $admin] = annualWorkspace();

    $this->artisan('billing:renewal-reminders')->assertExitCode(0);

    Notification::assertSentTo([$owner, $admin], AnnualRenewalReminderNotification::class);
    expect($workspace->subscription->fresh()->renewal_reminded_at)->not->toBeNull();
});

it('does not remind twice for the same period', function () {
    Notification::fake();
    [$workspace, $owner] = annualWorkspace();

    $this->artisan('billing:renewal-reminders');
    $this->artisan('billing:renewal-reminders');

    Notification::assertSentToTimes($owner, AnnualRenewalReminderNotification::class, 1);
});

it('does not remind a monthly subscription', function () {
    Notification::fake();
    [$workspace, $owner] = annualWorkspace(['billing_interval' => 'monthly']);

    $this->artisan('billing:renewal-reminders');

    Notification::assertNothingSentTo($owner);
});

it('does not remind when the renewal is more than a week away', function () {
    Notification::fake();
    [$workspace, $owner] = annualWorkspace(['current_period_ends_at' => now()->addDays(20)]);

    $this->artisan('billing:renewal-reminders');

    Notification::assertNothingSentTo($owner);
});

it('does not remind a subscription already scheduled to cancel', function () {
    Notification::fake();
    [$workspace, $owner] = annualWorkspace(['cancels_at' => now()->addDays(5)]);

    $this->artisan('billing:renewal-reminders');

    Notification::assertNothingSentTo($owner);
});
