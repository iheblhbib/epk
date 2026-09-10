<?php

use App\Enums\EpkStatus;
use App\Enums\SubscriptionStatus;
use App\Enums\WorkspaceRole;
use App\Models\Artist;
use App\Models\Epk;
use App\Models\User;
use App\Models\Workspace;
use App\Notifications\DraftEpkReminderNotification;
use Illuminate\Support\Facades\Notification;

/**
 * @return array{0: Workspace, 1: User, 2: User}
 *                                               [workspace, owner, admin]
 */
function nudgeWorkspace(): array
{
    $owner = User::factory()->create();
    $admin = User::factory()->create();
    $workspace = Workspace::factory()->create(['created_by' => $owner->id]);
    $workspace->subscription()->update(['status' => SubscriptionStatus::Active, 'trial_ends_at' => null]);
    $workspace->members()->create(['user_id' => $owner->id, 'role' => WorkspaceRole::Owner, 'status' => 'active', 'joined_at' => now()]);
    $workspace->members()->create(['user_id' => $admin->id, 'role' => WorkspaceRole::Admin, 'status' => 'active', 'joined_at' => now()]);

    return [$workspace, $owner, $admin];
}

function draftEpk(Workspace $workspace, array $attributes = []): Epk
{
    $artist = Artist::factory()->create(['workspace_id' => $workspace->id]);

    return Epk::factory()->create([
        'workspace_id' => $workspace->id,
        'artist_id' => $artist->id,
        'status' => EpkStatus::Draft,
        'published_at' => null,
        'created_at' => now()->subDays(8),
        ...$attributes,
    ]);
}

it('nudges owners and admins about an EPK that has been a draft for a week', function () {
    Notification::fake();
    [$workspace, $owner, $admin] = nudgeWorkspace();
    $epk = draftEpk($workspace, ['title' => 'Unfinished EPK']);

    $this->artisan('epks:draft-nudge')->assertExitCode(0);

    Notification::assertSentTo([$owner, $admin], DraftEpkReminderNotification::class);
    expect($epk->fresh()->draft_nudged_at)->not->toBeNull();
});

it('does not nudge a draft younger than 7 days', function () {
    Notification::fake();
    [$workspace, $owner] = nudgeWorkspace();
    draftEpk($workspace, ['created_at' => now()->subDays(3)]);

    $this->artisan('epks:draft-nudge');

    Notification::assertNothingSentTo($owner);
});

it('does not nudge an EPK that was ever published', function () {
    Notification::fake();
    [$workspace, $owner] = nudgeWorkspace();
    // Published then unpublished: status is Draft again, but published_at is set.
    draftEpk($workspace, ['published_at' => now()->subDays(2)]);

    $this->artisan('epks:draft-nudge');

    Notification::assertNothingSentTo($owner);
});

it('nudges each draft only once', function () {
    Notification::fake();
    [$workspace, $owner] = nudgeWorkspace();
    draftEpk($workspace);

    $this->artisan('epks:draft-nudge');
    Notification::assertSentToTimes($owner, DraftEpkReminderNotification::class, 1);

    $this->artisan('epks:draft-nudge');
    Notification::assertSentToTimes($owner, DraftEpkReminderNotification::class, 1);
});

it('does not nudge a locked workspace', function () {
    Notification::fake();
    [$workspace, $owner] = nudgeWorkspace();
    $workspace->subscription()->update(['status' => SubscriptionStatus::Canceled]);
    draftEpk($workspace);

    $this->artisan('epks:draft-nudge');

    Notification::assertNothingSentTo($owner);
});

it('respects a draft-reminder opt-out', function () {
    Notification::fake();
    [$workspace, $owner, $admin] = nudgeWorkspace();
    $owner->update(['notification_preferences' => ['draft_reminder' => ['mail' => false, 'database' => false]]]);
    draftEpk($workspace);

    $this->artisan('epks:draft-nudge');

    Notification::assertNotSentTo($owner, DraftEpkReminderNotification::class);
    Notification::assertSentTo($admin, DraftEpkReminderNotification::class);
});
