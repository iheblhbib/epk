<?php

use App\Enums\AnalyticsEventType;
use App\Enums\SubscriptionStatus;
use App\Enums\WorkspaceRole;
use App\Models\AnalyticsEvent;
use App\Models\Artist;
use App\Models\Epk;
use App\Models\User;
use App\Models\Workspace;
use App\Notifications\ViewMilestoneNotification;
use Illuminate\Support\Facades\Notification;

/**
 * @return array{0: Workspace, 1: User, 2: Epk}
 *                                              [workspace, owner, published epk]
 */
function milestoneSetup(int $pageViews, array $epkAttributes = []): array
{
    $owner = User::factory()->create();
    $workspace = Workspace::factory()->create(['created_by' => $owner->id]);
    $workspace->subscription()->update(['status' => SubscriptionStatus::Active, 'trial_ends_at' => null]);
    $workspace->members()->create(['user_id' => $owner->id, 'role' => WorkspaceRole::Owner, 'status' => 'active', 'joined_at' => now()]);

    $artist = Artist::factory()->create(['workspace_id' => $workspace->id]);
    $epk = Epk::factory()->published()->create([
        'workspace_id' => $workspace->id,
        'artist_id' => $artist->id,
        'title' => 'Rising EPK',
        ...$epkAttributes,
    ]);

    if ($pageViews > 0) {
        AnalyticsEvent::factory()->for($epk)->type(AnalyticsEventType::PageView)->count($pageViews)->create();
    }

    return [$workspace, $owner, $epk];
}

it('announces the first 100-view milestone', function () {
    Notification::fake();
    [$workspace, $owner, $epk] = milestoneSetup(120);

    $this->artisan('epks:view-milestones')->assertExitCode(0);

    Notification::assertSentTo(
        $owner,
        ViewMilestoneNotification::class,
        fn ($notification) => $notification->milestone === 100
    );
    expect($epk->fresh()->last_view_milestone)->toBe(100);
});

it('announces only the highest newly crossed milestone on a big jump', function () {
    Notification::fake();
    [$workspace, $owner, $epk] = milestoneSetup(1200, ['last_view_milestone' => 100]);

    $this->artisan('epks:view-milestones');

    Notification::assertSentTo(
        $owner,
        ViewMilestoneNotification::class,
        fn ($notification) => $notification->milestone === 1000
    );
    expect($epk->fresh()->last_view_milestone)->toBe(1000);
});

it('does not re-announce a milestone already recorded', function () {
    Notification::fake();
    [$workspace, $owner] = milestoneSetup(120, ['last_view_milestone' => 100]);

    $this->artisan('epks:view-milestones');

    Notification::assertNothingSentTo($owner);
});

it('ignores a draft EPK even past a milestone', function () {
    Notification::fake();
    $owner = User::factory()->create();
    $workspace = Workspace::factory()->create(['created_by' => $owner->id]);
    $workspace->subscription()->update(['status' => SubscriptionStatus::Active, 'trial_ends_at' => null]);
    $workspace->members()->create(['user_id' => $owner->id, 'role' => WorkspaceRole::Owner, 'status' => 'active', 'joined_at' => now()]);
    $artist = Artist::factory()->create(['workspace_id' => $workspace->id]);
    $epk = Epk::factory()->create(['workspace_id' => $workspace->id, 'artist_id' => $artist->id]);
    AnalyticsEvent::factory()->for($epk)->type(AnalyticsEventType::PageView)->count(150)->create();

    $this->artisan('epks:view-milestones');

    Notification::assertNothingSentTo($owner);
});

it('does not announce milestones for a locked workspace', function () {
    Notification::fake();
    [$workspace, $owner] = milestoneSetup(120);
    $workspace->subscription()->update(['status' => SubscriptionStatus::Canceled]);

    $this->artisan('epks:view-milestones');

    Notification::assertNothingSentTo($owner);
});

it('respects a view-milestone opt-out', function () {
    Notification::fake();
    [$workspace, $owner] = milestoneSetup(120);
    $owner->update(['notification_preferences' => ['view_milestone' => ['mail' => false]]]);

    $this->artisan('epks:view-milestones');

    Notification::assertSentTo(
        $owner,
        ViewMilestoneNotification::class,
        fn ($notification, $channels) => $channels === ['database']
    );
});
