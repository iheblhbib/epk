<?php

use App\Enums\AnalyticsEventType;
use App\Enums\WorkspaceRole;
use App\Models\AnalyticsEvent;
use App\Models\Artist;
use App\Models\Epk;
use App\Models\User;
use App\Models\Workspace;

function analyticsWorkspaceWithMember(WorkspaceRole $role): array
{
    $workspace = Workspace::factory()->create();
    $user = User::factory()->create();
    $workspace->members()->create(['user_id' => $user->id, 'role' => $role, 'status' => 'active', 'joined_at' => now()]);

    return [$workspace, $user];
}

function publishedEpkFor(Workspace $workspace): Epk
{
    $artist = Artist::factory()->create(['workspace_id' => $workspace->id]);

    return Epk::factory()->published()->create(['workspace_id' => $workspace->id, 'artist_id' => $artist->id]);
}

// --- Public event tracking ---

it('records a page view for a published epk with no authentication', function () {
    $epk = publishedEpkFor(Workspace::factory()->create());

    $response = $this->postJson("/api/public/epks/{$epk->slug}/events", ['type' => 'page_view']);

    $response->assertCreated();
    $this->assertDatabaseHas('analytics_events', ['epk_id' => $epk->id, 'type' => 'page_view']);
});

it('stores the download filename in meta', function () {
    $epk = publishedEpkFor(Workspace::factory()->create());

    $this->postJson("/api/public/epks/{$epk->slug}/events", [
        'type' => 'download',
        'meta' => ['filename' => 'presskit.pdf'],
    ])->assertCreated();

    $event = AnalyticsEvent::first();
    expect($event->meta)->toBe(['filename' => 'presskit.pdf']);
});

it('gives the same visitor the same visitor_hash across requests', function () {
    $epk = publishedEpkFor(Workspace::factory()->create());

    $this->postJson("/api/public/epks/{$epk->slug}/events", ['type' => 'page_view'])->assertCreated();
    $this->postJson("/api/public/epks/{$epk->slug}/events", ['type' => 'audio_play'])->assertCreated();

    $hashes = AnalyticsEvent::pluck('visitor_hash')->unique();
    expect($hashes)->toHaveCount(1);
});

it('never stores a raw ip address', function () {
    $epk = publishedEpkFor(Workspace::factory()->create());

    $this->postJson("/api/public/epks/{$epk->slug}/events", ['type' => 'page_view'])->assertCreated();

    $event = AnalyticsEvent::first();
    expect($event->visitor_hash)->not->toContain('127.0.0.1');
    expect(strlen($event->visitor_hash))->toBe(64); // sha256 hex length
});

it('rejects an unknown event type', function () {
    $epk = publishedEpkFor(Workspace::factory()->create());

    $this->postJson("/api/public/epks/{$epk->slug}/events", ['type' => 'not-a-real-type'])
        ->assertUnprocessable();
});

it('404s when tracking an event for a draft or unknown epk', function () {
    $draft = Epk::factory()->create();

    $this->postJson("/api/public/epks/{$draft->slug}/events", ['type' => 'page_view'])->assertNotFound();
    $this->postJson('/api/public/epks/does-not-exist/events', ['type' => 'page_view'])->assertNotFound();
});

// --- Authenticated aggregation ---

it('denies analytics access to a non-member', function () {
    [$workspace] = analyticsWorkspaceWithMember(WorkspaceRole::Owner);
    $epk = publishedEpkFor($workspace);
    $outsider = User::factory()->create();

    $this->actingAs($outsider)->getJson("/api/epks/{$epk->id}/analytics")->assertForbidden();
});

it('lets a viewer see analytics (read-only ability)', function () {
    [$workspace, $viewer] = analyticsWorkspaceWithMember(WorkspaceRole::Viewer);
    $epk = publishedEpkFor($workspace);

    $this->actingAs($viewer)->getJson("/api/epks/{$epk->id}/analytics")->assertOk();
});

it('summarizes totals, daily views, referrers, countries, devices, and downloads', function () {
    [$workspace, $owner] = analyticsWorkspaceWithMember(WorkspaceRole::Owner);
    $epk = publishedEpkFor($workspace);

    AnalyticsEvent::factory()->for($epk)->type(AnalyticsEventType::PageView)->count(3)->create([
        'referrer_host' => 'google.com',
        'country' => 'US',
        'device_type' => 'desktop',
    ]);
    // country pinned to 3 different non-US values here (rather than left to
    // the factory's random default, which could repeat and tie or exceed
    // 'US') so top_countries.0 is deterministically 'US' at 3 versus any
    // other single country capped at 1 — top_countries aggregates every
    // event type, not just page views, and an unpinned random country
    // occasionally tied or beat 'US' by chance, making the assertion below
    // flaky.
    AnalyticsEvent::factory()->for($epk)->type(AnalyticsEventType::Download)->create([
        'meta' => ['filename' => 'presskit.pdf'],
        'referrer_host' => null,
        'country' => 'GB',
    ]);
    AnalyticsEvent::factory()->for($epk)->type(AnalyticsEventType::AudioPlay)->create(['referrer_host' => null, 'country' => 'FR']);
    AnalyticsEvent::factory()->for($epk)->type(AnalyticsEventType::VideoPlay)->create(['referrer_host' => null, 'country' => 'DE']);

    $response = $this->actingAs($owner)->getJson("/api/epks/{$epk->id}/analytics");

    $response->assertOk();
    $response->assertJsonPath('data.totals.page_views', 3);
    $response->assertJsonPath('data.totals.downloads', 1);
    $response->assertJsonPath('data.totals.audio_plays', 1);
    $response->assertJsonPath('data.totals.video_plays', 1);
    $response->assertJsonPath('data.top_referrers.0.referrer', 'google.com');
    $response->assertJsonPath('data.top_referrers.0.count', 3);
    $response->assertJsonPath('data.top_countries.0.country', 'US');
    $response->assertJsonPath('data.devices.0.device_type', 'desktop');
    $response->assertJsonPath('data.top_downloads.0.filename', 'presskit.pdf');
});

it('excludes events outside the default 30-day range', function () {
    [$workspace, $owner] = analyticsWorkspaceWithMember(WorkspaceRole::Owner);
    $epk = publishedEpkFor($workspace);

    AnalyticsEvent::factory()->for($epk)->onDate(now()->subDays(60))->create();
    AnalyticsEvent::factory()->for($epk)->onDate(now())->create();

    $response = $this->actingAs($owner)->getJson("/api/epks/{$epk->id}/analytics");

    $response->assertOk();
    $response->assertJsonPath('data.totals.page_views', 1);
});

it('respects explicit from/to query params', function () {
    [$workspace, $owner] = analyticsWorkspaceWithMember(WorkspaceRole::Owner);
    $epk = publishedEpkFor($workspace);

    AnalyticsEvent::factory()->for($epk)->onDate(now()->subDays(10))->create();
    AnalyticsEvent::factory()->for($epk)->onDate(now())->create();

    $from = now()->subDays(5)->toDateString();
    $response = $this->actingAs($owner)->getJson("/api/epks/{$epk->id}/analytics?from={$from}");

    $response->assertOk();
    $response->assertJsonPath('data.totals.page_views', 1);
});

it('counts unique visitors by distinct visitor_hash, not raw event count', function () {
    [$workspace, $owner] = analyticsWorkspaceWithMember(WorkspaceRole::Owner);
    $epk = publishedEpkFor($workspace);

    AnalyticsEvent::factory()->for($epk)->count(3)->create(['visitor_hash' => 'same-visitor']);
    AnalyticsEvent::factory()->for($epk)->create(['visitor_hash' => 'another-visitor']);

    $response = $this->actingAs($owner)->getJson("/api/epks/{$epk->id}/analytics");

    $response->assertOk();
    $response->assertJsonPath('data.totals.unique_visitors', 2);
});
