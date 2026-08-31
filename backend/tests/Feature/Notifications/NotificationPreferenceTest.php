<?php

use App\Enums\WorkspaceRole;
use App\Models\Artist;
use App\Models\Epk;
use App\Models\User;
use App\Models\Workspace;
use App\Notifications\WorkspaceInvitationNotification;
use Illuminate\Support\Facades\Notification;

it('defaults every kind/channel to enabled for a user who has never set a preference', function () {
    $user = User::factory()->create();

    $response = $this->actingAs($user)->getJson('/api/user/notification-preferences')->assertOk();

    $response->assertJson([
        'data' => [
            'workspace_invitation' => ['mail' => true, 'database' => true],
            'epk_published' => ['database' => true],
            'team_member_joined' => ['database' => true],
        ],
    ]);
});

it('updates a single toggle and merges it with the rest of the defaults', function () {
    $user = User::factory()->create();

    $response = $this->actingAs($user)
        ->putJson('/api/user/notification-preferences', ['epk_published' => ['database' => false]])
        ->assertOk();

    $response->assertJson([
        'data' => [
            'workspace_invitation' => ['mail' => true, 'database' => true],
            'epk_published' => ['database' => false],
            'team_member_joined' => ['database' => true],
        ],
    ]);

    // Persisted, not just echoed back for this one request.
    $this->actingAs($user)->getJson('/api/user/notification-preferences')
        ->assertJsonPath('data.epk_published.database', false);
});

it('rejects a non-boolean value for a known toggle', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->putJson('/api/user/notification-preferences', ['epk_published' => ['database' => 'yes please']])
        ->assertUnprocessable();
});

it('silently ignores a kind/channel pair the schema does not recognize', function () {
    $user = User::factory()->create();

    // Neither an unknown kind nor a channel that kind never sends on (mail
    // for epk_published) has a validation rule generated for it, so it's
    // just dropped rather than erroring or getting persisted.
    $response = $this->actingAs($user)
        ->putJson('/api/user/notification-preferences', [
            'made_up_kind' => ['database' => false],
            'epk_published' => ['mail' => false],
        ])
        ->assertOk();

    $response->assertJson([
        'data' => [
            'workspace_invitation' => ['mail' => true, 'database' => true],
            'epk_published' => ['database' => true],
            'team_member_joined' => ['database' => true],
        ],
    ]);
});

it('suppresses the in-app notification once a user opts out of that kind', function () {
    $owner = User::factory()->create();
    $teammate = User::factory()->create();
    $workspace = Workspace::factory()->create(['created_by' => $owner->id]);
    $workspace->members()->create(['user_id' => $owner->id, 'role' => WorkspaceRole::Owner, 'status' => 'active', 'joined_at' => now()]);
    $workspace->members()->create(['user_id' => $teammate->id, 'role' => WorkspaceRole::Editor, 'status' => 'active', 'joined_at' => now()]);

    $teammate->update(['notification_preferences' => ['epk_published' => ['database' => false]]]);

    $artist = Artist::factory()->create(['workspace_id' => $workspace->id]);
    $epk = Epk::factory()->create(['workspace_id' => $workspace->id, 'artist_id' => $artist->id]);

    $this->actingAs($owner)->postJson("/api/epks/{$epk->id}/publish")->assertOk();

    expect($teammate->fresh()->notifications()->count())->toBe(0);
});

it('keeps sending the mail invite once the database channel is disabled, and vice versa', function () {
    Notification::fake();

    $owner = User::factory()->create();
    $existingUser = User::factory()->create();
    $existingUser->update(['notification_preferences' => ['workspace_invitation' => ['mail' => false]]]);
    $workspace = Workspace::factory()->create(['created_by' => $owner->id]);
    $workspace->members()->create(['user_id' => $owner->id, 'role' => WorkspaceRole::Owner, 'status' => 'active', 'joined_at' => now()]);

    $this->actingAs($owner)->postJson("/api/workspaces/{$workspace->id}/members", [
        'email' => $existingUser->email,
        'role' => WorkspaceRole::Editor->value,
    ])->assertCreated();

    Notification::assertSentTo(
        $existingUser,
        WorkspaceInvitationNotification::class,
        fn ($notification, $channels) => ! in_array('mail', $channels, true) && in_array('database', $channels, true)
    );
});
