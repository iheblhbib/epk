<?php

use App\Enums\AnalyticsEventType;
use App\Enums\SubscriptionStatus;
use App\Enums\WorkspaceRole;
use App\Models\AnalyticsEvent;
use App\Models\Artist;
use App\Models\Epk;
use App\Models\User;
use App\Models\Workspace;
use App\Notifications\WeeklyDigestNotification;
use Illuminate\Support\Facades\Notification;

/**
 * @return array{0: Workspace, 1: User, 2: User, 3: Epk}
 *                                                       [workspace, owner, admin, published epk]
 */
function digestSetup(): array
{
    $owner = User::factory()->create();
    $admin = User::factory()->create();
    $workspace = Workspace::factory()->create(['created_by' => $owner->id]);
    $workspace->subscription()->update(['status' => SubscriptionStatus::Active, 'trial_ends_at' => null]);
    $workspace->members()->create(['user_id' => $owner->id, 'role' => WorkspaceRole::Owner, 'status' => 'active', 'joined_at' => now()]);
    $workspace->members()->create(['user_id' => $admin->id, 'role' => WorkspaceRole::Admin, 'status' => 'active', 'joined_at' => now()]);

    $artist = Artist::factory()->create(['workspace_id' => $workspace->id]);
    $epk = Epk::factory()->published()->create(['workspace_id' => $workspace->id, 'artist_id' => $artist->id, 'title' => 'Live EPK']);

    return [$workspace, $owner, $admin, $epk];
}

it('sends a weekly digest to owners and admins with this week\'s totals', function () {
    Notification::fake();
    [$workspace, $owner, $admin, $epk] = digestSetup();

    AnalyticsEvent::factory()->for($epk)->type(AnalyticsEventType::PageView)->count(9)->create(['created_at' => now()->subDays(2)]);
    AnalyticsEvent::factory()->for($epk)->type(AnalyticsEventType::Download)->count(2)->create(['created_at' => now()->subDays(2)]);
    // Prior week — feeds the week-over-week delta, not this week's total.
    AnalyticsEvent::factory()->for($epk)->type(AnalyticsEventType::PageView)->count(4)->create(['created_at' => now()->subDays(10)]);

    $this->artisan('digest:weekly')->assertExitCode(0);

    Notification::assertSentTo(
        [$owner, $admin],
        WeeklyDigestNotification::class,
        fn ($notification) => $notification->digest['page_views'] === 9
            && $notification->digest['downloads'] === 2
            && $notification->digest['previous_page_views'] === 4
    );
});

it('does not send a digest for a week with no page views', function () {
    Notification::fake();
    [$workspace, $owner, $admin, $epk] = digestSetup();
    AnalyticsEvent::factory()->for($epk)->type(AnalyticsEventType::PageView)->count(5)->create(['created_at' => now()->subDays(20)]);

    $this->artisan('digest:weekly');

    Notification::assertNothingSentTo($owner);
});

it('does not send a digest to a workspace with no published EPK', function () {
    Notification::fake();
    $owner = User::factory()->create();
    $workspace = Workspace::factory()->create(['created_by' => $owner->id]);
    $workspace->subscription()->update(['status' => SubscriptionStatus::Active, 'trial_ends_at' => null]);
    $workspace->members()->create(['user_id' => $owner->id, 'role' => WorkspaceRole::Owner, 'status' => 'active', 'joined_at' => now()]);

    $this->artisan('digest:weekly');

    Notification::assertNothingSentTo($owner);
});

it('does not send a digest to a locked workspace', function () {
    Notification::fake();
    [$workspace, $owner, $admin, $epk] = digestSetup();
    AnalyticsEvent::factory()->for($epk)->type(AnalyticsEventType::PageView)->count(9)->create(['created_at' => now()->subDays(2)]);
    $workspace->subscription()->update(['status' => SubscriptionStatus::Canceled]);

    $this->artisan('digest:weekly');

    Notification::assertNothingSentTo($owner);
});

it('respects a weekly-digest opt-out', function () {
    Notification::fake();
    [$workspace, $owner, $admin, $epk] = digestSetup();
    AnalyticsEvent::factory()->for($epk)->type(AnalyticsEventType::PageView)->count(9)->create(['created_at' => now()->subDays(2)]);
    $owner->update(['notification_preferences' => ['weekly_digest' => ['mail' => false, 'database' => false]]]);

    $this->artisan('digest:weekly');

    Notification::assertNotSentTo($owner, WeeklyDigestNotification::class);
    Notification::assertSentTo($admin, WeeklyDigestNotification::class);
});
