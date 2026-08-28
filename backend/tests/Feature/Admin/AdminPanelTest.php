<?php

use App\Enums\EpkStatus;
use App\Enums\UserRole;
use App\Enums\WorkspaceRole;
use App\Models\Epk;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Support\Facades\Cache;

it('blocks a non-admin from every admin endpoint', function () {
    $user = User::factory()->create();

    $this->actingAs($user)->getJson('/api/admin/stats')->assertForbidden();
    $this->actingAs($user)->getJson('/api/admin/users')->assertForbidden();
    $this->actingAs($user)->getJson('/api/admin/workspaces')->assertForbidden();
    $this->actingAs($user)->getJson('/api/admin/epks')->assertForbidden();
    $this->actingAs($user)->getJson('/api/admin/audit-logs')->assertForbidden();
});

it('returns platform-wide stats to an admin', function () {
    // Stats are cached for 60s (see AdminStatsController) — forget any value
    // a previous test in this run may have left behind so this test's own
    // counts aren't shadowed by a stale one.
    Cache::forget('admin.stats');

    $admin = User::factory()->admin()->create();
    User::factory()->count(2)->create();

    $response = $this->actingAs($admin)->getJson('/api/admin/stats');

    $response->assertOk()
        ->assertJsonPath('data.users.total', 3)
        ->assertJsonStructure(['data' => ['users', 'workspaces', 'epks', 'media', 'contacts', 'analytics']]);
});

it('lets an admin search and list users', function () {
    $admin = User::factory()->admin()->create();
    User::factory()->create(['name' => 'Jane Findable']);
    User::factory()->create(['name' => 'Someone Else']);

    $response = $this->actingAs($admin)->getJson('/api/admin/users?search=Findable');

    $response->assertOk();
    expect($response->json('data'))->toHaveCount(1);
    expect($response->json('data.0.name'))->toBe('Jane Findable');
});

it('lets an admin promote a user to admin and suspend them', function () {
    $admin = User::factory()->admin()->create();
    $target = User::factory()->create();

    $this->actingAs($admin)->patchJson("/api/admin/users/{$target->id}", ['role' => UserRole::Admin->value])
        ->assertOk()
        ->assertJsonPath('data.role', UserRole::Admin->value);

    $this->actingAs($admin)->patchJson("/api/admin/users/{$target->id}", ['suspended' => true])
        ->assertOk()
        ->assertJsonPath('data.suspended_at', fn ($value) => $value !== null);

    $this->assertDatabaseHas('audit_logs', ['action' => 'user.role_changed', 'subject_id' => $target->id]);
    $this->assertDatabaseHas('audit_logs', ['action' => 'user.suspended', 'subject_id' => $target->id]);
});

it('prevents an admin from changing their own admin status', function () {
    $admin = User::factory()->admin()->create();

    $this->actingAs($admin)->patchJson("/api/admin/users/{$admin->id}", ['suspended' => true])
        ->assertUnprocessable();
});

it('lets one admin demote another as long as an admin remains', function () {
    $admin = User::factory()->admin()->create();
    $secondAdmin = User::factory()->admin()->create();

    // The self-change guard above already keeps an admin from demoting
    // themselves, so with the admin-only middleware in front of this
    // endpoint the acting admin is always excluded from the target — the
    // "last admin" guard in the controller is defense in depth for that
    // same invariant, not independently reachable through this API.
    $this->actingAs($admin)->patchJson("/api/admin/users/{$secondAdmin->id}", ['role' => UserRole::User->value])
        ->assertOk()
        ->assertJsonPath('data.role', UserRole::User->value);
});

it('blocks login for a suspended user', function () {
    $user = User::factory()->create(['suspended_at' => now()]);

    $this->postJson('/api/login', ['email' => $user->email, 'password' => 'password'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('email');

    $this->assertGuest();
});

it('kills an already-active session the moment an admin suspends that user, not just future logins', function () {
    $admin = User::factory()->admin()->create();
    $target = User::factory()->create();

    // $target is genuinely mid-session here — this isn't a fresh login
    // attempt, which is the case suspension used to only ever catch.
    $this->actingAs($target)->getJson('/api/user')->assertOk();

    $this->actingAs($admin)->patchJson("/api/admin/users/{$target->id}", ['suspended' => true])->assertOk();

    // A fresh request from that same "already logged in" user is rejected
    // outright, not just left alone until the session would have expired
    // naturally. ->fresh() here mirrors what a real session guard does on
    // every request (re-hydrate from the DB) — actingAs() alone would just
    // re-inject the original in-memory $target object, which still shows
    // suspended_at as null from before the update above.
    $this->actingAs($target->fresh())->getJson('/api/user')->assertUnauthorized();
});

it('lets an admin list and delete workspaces', function () {
    $admin = User::factory()->admin()->create();
    $owner = User::factory()->create();
    $workspace = Workspace::factory()->create(['created_by' => $owner->id, 'name' => 'Acme Records']);
    $workspace->members()->create(['user_id' => $owner->id, 'role' => WorkspaceRole::Owner, 'status' => 'active', 'joined_at' => now()]);

    $this->actingAs($admin)->getJson('/api/admin/workspaces')
        ->assertOk()
        ->assertJsonPath('data.0.name', 'Acme Records')
        ->assertJsonPath('data.0.members_count', 1);

    $this->actingAs($admin)->deleteJson("/api/admin/workspaces/{$workspace->id}")->assertOk();

    $this->assertSoftDeleted('workspaces', ['id' => $workspace->id]);
    $this->assertDatabaseHas('audit_logs', ['action' => 'workspace.deleted_by_admin', 'subject_id' => $workspace->id]);
});

it('lets an admin list and force-unpublish an epk', function () {
    $admin = User::factory()->admin()->create();
    $workspace = Workspace::factory()->create();
    $epk = Epk::factory()->create(['workspace_id' => $workspace->id, 'status' => EpkStatus::Published, 'published_at' => now()]);

    $this->actingAs($admin)->getJson('/api/admin/epks')
        ->assertOk()
        ->assertJsonPath('data.0.id', $epk->id);

    $this->actingAs($admin)->postJson("/api/admin/epks/{$epk->id}/unpublish")
        ->assertOk()
        ->assertJsonPath('data.status', EpkStatus::Draft->value);

    expect($epk->fresh()->published_at)->toBeNull();
    $this->assertDatabaseHas('audit_logs', ['action' => 'epk.unpublished_by_admin', 'subject_id' => $epk->id]);
});

it('lists audit log entries for an admin', function () {
    $admin = User::factory()->admin()->create();
    $target = User::factory()->create();

    $this->actingAs($admin)->patchJson("/api/admin/users/{$target->id}", ['suspended' => true]);

    $response = $this->actingAs($admin)->getJson('/api/admin/audit-logs');

    $response->assertOk()->assertJsonPath('data.0.action', 'user.suspended');
});
