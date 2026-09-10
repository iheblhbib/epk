<?php

use App\Enums\SubscriptionPlan;
use App\Enums\SubscriptionStatus;
use App\Enums\WorkspaceRole;
use App\Models\User;
use App\Models\Workspace;
use App\Notifications\TrialEndedNotification;
use App\Notifications\TrialEndingNotification;
use Illuminate\Support\Facades\Notification;

/**
 * @return array{0: Workspace, 1: User, 2: User, 3: User}
 *                                                        [workspace, owner, admin, editor]
 */
function trialWorkspace(string $trialEndsIn): array
{
    $owner = User::factory()->create();
    $admin = User::factory()->create();
    $editor = User::factory()->create();
    $workspace = Workspace::factory()->create(['created_by' => $owner->id]);

    $workspace->subscription()->update([
        'status' => SubscriptionStatus::Trialing,
        'trial_ends_at' => now()->add($trialEndsIn),
        'trial_reminder_stage' => null,
    ]);

    $workspace->members()->create(['user_id' => $owner->id, 'role' => WorkspaceRole::Owner, 'status' => 'active', 'joined_at' => now()]);
    $workspace->members()->create(['user_id' => $admin->id, 'role' => WorkspaceRole::Admin, 'status' => 'active', 'joined_at' => now()]);
    $workspace->members()->create(['user_id' => $editor->id, 'role' => WorkspaceRole::Editor, 'status' => 'active', 'joined_at' => now()]);

    return [$workspace, $owner, $admin, $editor];
}

it('sends the 3-day trial reminder to owners and admins, not editors', function () {
    Notification::fake();
    [$workspace, $owner, $admin, $editor] = trialWorkspace('2 days 12 hours');

    $this->artisan('billing:trial-reminders')->assertExitCode(0);

    Notification::assertSentTo([$owner, $admin], TrialEndingNotification::class);
    Notification::assertNotSentTo($editor, TrialEndingNotification::class);
    expect($workspace->subscription->fresh()->trial_reminder_stage)->toBe('3');
});

it('does not re-send the 3-day reminder on a later run', function () {
    Notification::fake();
    [$workspace, $owner] = trialWorkspace('2 days 12 hours');

    $this->artisan('billing:trial-reminders');
    Notification::assertSentToTimes($owner, TrialEndingNotification::class, 1);

    $this->artisan('billing:trial-reminders');
    Notification::assertSentToTimes($owner, TrialEndingNotification::class, 1);
});

it('advances to the 1-day reminder as the trial gets closer', function () {
    Notification::fake();
    [$workspace, $owner] = trialWorkspace('16 hours');
    $workspace->subscription()->update(['trial_reminder_stage' => '3']);

    $this->artisan('billing:trial-reminders');

    Notification::assertSentTo(
        $owner,
        TrialEndingNotification::class,
        fn ($notification) => $notification->daysLeft === 1
    );
    expect($workspace->subscription->fresh()->trial_reminder_stage)->toBe('1');
});

it('sends the trial-ended notice once the trial has lapsed', function () {
    Notification::fake();
    [$workspace, $owner, $admin] = trialWorkspace('-2 hours');

    $this->artisan('billing:trial-reminders');

    Notification::assertSentTo([$owner, $admin], TrialEndedNotification::class);
    expect($workspace->subscription->fresh()->trial_reminder_stage)->toBe('ended');

    // And never again.
    $this->artisan('billing:trial-reminders');
    Notification::assertSentToTimes($owner, TrialEndedNotification::class, 1);
});

it('skips a lapsed trial jumping straight from no reminder to ended', function () {
    Notification::fake();
    [$workspace, $owner] = trialWorkspace('-1 day');

    $this->artisan('billing:trial-reminders');

    Notification::assertNotSentTo($owner, TrialEndingNotification::class);
    Notification::assertSentTo($owner, TrialEndedNotification::class);
});

it('does not remind a workspace that already subscribed', function () {
    Notification::fake();
    [$workspace, $owner] = trialWorkspace('2 days');
    $workspace->subscription()->update([
        'status' => SubscriptionStatus::Active,
        'plan' => SubscriptionPlan::Pro,
        'trial_ends_at' => null,
    ]);

    $this->artisan('billing:trial-reminders');

    Notification::assertNothingSentTo($owner);
});
