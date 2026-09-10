<?php

use App\Enums\SubscriptionPlan;
use App\Enums\WorkspaceRole;
use App\Models\Artist;
use App\Models\Epk;
use App\Models\PrivateLink;
use App\Models\User;
use App\Models\Workspace;
use App\Notifications\PrivateLinkShared;
use Illuminate\Support\Facades\Notification;

function sendableLink(WorkspaceRole $role = WorkspaceRole::Editor, array $linkAttributes = []): array
{
    $workspace = Workspace::factory()->create();
    $workspace->subscription()->update(['plan' => SubscriptionPlan::Pro]);
    $user = User::factory()->create();
    $workspace->members()->create(['user_id' => $user->id, 'role' => $role, 'status' => 'active', 'joined_at' => now()]);

    $artist = Artist::factory()->create(['workspace_id' => $workspace->id]);
    $epk = Epk::factory()->create(['workspace_id' => $workspace->id, 'artist_id' => $artist->id]);
    $link = PrivateLink::factory()->for($epk)->create(array_merge(['created_by' => $user->id], $linkAttributes));

    return [$link, $epk, $user, $workspace];
}

it('emails a private link to a recipient and records the send', function () {
    Notification::fake();
    [$link, $epk, $editor] = sendableLink();

    $response = $this->actingAs($editor)->postJson("/api/epks/{$epk->id}/private-links/{$link->id}/send", [
        'recipient_email' => 'journalist@example.com',
        'recipient_name' => 'Jamie Reporter',
        'message' => 'Hope you like it.',
    ]);

    $response->assertOk();

    Notification::assertSentOnDemand(
        PrivateLinkShared::class,
        fn ($notification, $channels, $notifiable) => $notifiable->routes['mail'] === 'journalist@example.com'
            && $notification->privateLink->is($link)
    );

    $this->assertDatabaseHas('private_link_sends', [
        'private_link_id' => $link->id,
        'sent_by' => $editor->id,
        'recipient_email' => 'journalist@example.com',
        'recipient_name' => 'Jamie Reporter',
        'included_password' => false,
    ]);

    $this->assertDatabaseHas('audit_logs', [
        'action' => 'private_link.sent',
        'workspace_id' => $epk->workspace_id,
    ]);
});

it('returns the send in the updated link payload', function () {
    Notification::fake();
    [$link, $epk, $editor] = sendableLink();

    $response = $this->actingAs($editor)->postJson("/api/epks/{$epk->id}/private-links/{$link->id}/send", [
        'recipient_email' => 'journalist@example.com',
    ]);

    $response->assertOk();
    $response->assertJsonPath('data.sends.0.recipient_email', 'journalist@example.com');
});

it('includes the link password in the email only when asked and the sender proves they know it', function () {
    Notification::fake();
    [$link, $epk, $editor] = sendableLink(linkAttributes: []);
    $link->setPassword('correct-horse');
    $link->save();

    // Wrong password -> rejected.
    $this->actingAs($editor)->postJson("/api/epks/{$epk->id}/private-links/{$link->id}/send", [
        'recipient_email' => 'a@example.com',
        'include_password' => true,
        'password' => 'nope',
    ])->assertJsonValidationErrors('password');

    // Correct password -> included.
    $this->actingAs($editor)->postJson("/api/epks/{$epk->id}/private-links/{$link->id}/send", [
        'recipient_email' => 'b@example.com',
        'include_password' => true,
        'password' => 'correct-horse',
    ])->assertOk();

    $this->assertDatabaseHas('private_link_sends', [
        'recipient_email' => 'b@example.com',
        'included_password' => true,
    ]);

    Notification::assertSentOnDemand(
        PrivateLinkShared::class,
        function ($notification, $channels, $notifiable) {
            if ($notifiable->routes['mail'] !== 'b@example.com') {
                return false;
            }
            $rendered = collect($notification->toMail($notifiable)->outroLines)->implode(' ');

            return str_contains($rendered, 'correct-horse');
        }
    );
});

it('never puts the password in the email when include_password is false', function () {
    Notification::fake();
    [$link, $epk, $editor] = sendableLink();
    $link->setPassword('correct-horse');
    $link->save();

    $this->actingAs($editor)->postJson("/api/epks/{$epk->id}/private-links/{$link->id}/send", [
        'recipient_email' => 'c@example.com',
    ])->assertOk();

    Notification::assertSentOnDemand(
        PrivateLinkShared::class,
        function ($notification, $channels, $notifiable) {
            $mail = $notification->toMail($notifiable);
            $all = collect($mail->introLines)->merge($mail->outroLines)->implode(' ');

            return $notifiable->routes['mail'] === 'c@example.com' && ! str_contains($all, 'correct-horse');
        }
    );
});

it('refuses to send a revoked link', function () {
    Notification::fake();
    [$link, $epk, $editor] = sendableLink(linkAttributes: ['revoked_at' => now()]);

    $this->actingAs($editor)->postJson("/api/epks/{$epk->id}/private-links/{$link->id}/send", [
        'recipient_email' => 'x@example.com',
    ])->assertUnprocessable();

    Notification::assertNothingSent();
});

it('refuses to send an expired link', function () {
    Notification::fake();
    [$link, $epk, $editor] = sendableLink(linkAttributes: ['expires_at' => now()->subDay()]);

    $this->actingAs($editor)->postJson("/api/epks/{$epk->id}/private-links/{$link->id}/send", [
        'recipient_email' => 'x@example.com',
    ])->assertUnprocessable();

    Notification::assertNothingSent();
});

it('denies a viewer from sending a link', function () {
    Notification::fake();
    [$link, $epk, $viewer] = sendableLink(WorkspaceRole::Viewer);

    $this->actingAs($viewer)->postJson("/api/epks/{$epk->id}/private-links/{$link->id}/send", [
        'recipient_email' => 'x@example.com',
    ])->assertForbidden();
});

it('validates the recipient email', function () {
    Notification::fake();
    [$link, $epk, $editor] = sendableLink();

    $this->actingAs($editor)->postJson("/api/epks/{$epk->id}/private-links/{$link->id}/send", [
        'recipient_email' => 'not-an-email',
    ])->assertJsonValidationErrors('recipient_email');
});
