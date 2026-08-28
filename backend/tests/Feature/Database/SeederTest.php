<?php

use App\Enums\SubscriptionPlan;
use App\Enums\WorkspaceRole;
use App\Models\Workspace;

it('gives every seeded workspace a real subscription row, not just the default fallback', function () {
    $this->seed();

    $workspace = Workspace::where('slug', 'kitfolio-demo')->firstOrFail();

    // Regression: DatabaseSeeder used to run under WithoutModelEvents, which
    // silently skipped Workspace::booted()'s auto-provisioned Subscription
    // — so this row simply didn't exist after seeding, and PlanLimits fell
    // back to treating the workspace as Free even though the seeder's own
    // updateOrCreate() call (also silently) never took effect.
    expect($workspace->subscription)->not->toBeNull();
});

it('seeds the demo workspace on a paid plan so its 3 seeded members don\'t already exceed a limit', function () {
    $this->seed();

    $workspace = Workspace::where('slug', 'kitfolio-demo')->firstOrFail();

    expect($workspace->subscription->plan)->not->toBe(SubscriptionPlan::Free);
    expect($workspace->members()->count())->toBeGreaterThanOrEqual(3);

    $owner = $workspace->members()->where('role', WorkspaceRole::Owner)->firstOrFail()->user;

    // The actual regression this fixes: inviting a new teammate on the
    // freshly-seeded demo workspace used to 422 immediately, before a
    // first-time explorer ever got to try the feature.
    $this->actingAs($owner)->postJson("/api/workspaces/{$workspace->id}/members", [
        'email' => 'new-teammate@example.com',
        'role' => WorkspaceRole::Viewer->value,
    ])->assertCreated();
});
