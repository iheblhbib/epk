<?php

use App\Models\User;
use Illuminate\Auth\Notifications\VerifyEmail;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\URL;

it('verifies email via a valid signed url with no active session, and redirects to the frontend', function () {
    $user = User::factory()->unverified()->create();

    $url = URL::temporarySignedRoute(
        'verification.verify',
        now()->addMinutes(60),
        ['id' => $user->id, 'hash' => sha1($user->email)]
    );

    // Deliberately unauthenticated: a real email client opens this link with
    // no SPA session, possibly on a different device than registration.
    $response = $this->get($url);

    $response->assertRedirect();
    expect($response->headers->get('Location'))->toContain('/login?verified=1');

    expect($user->fresh()->hasVerifiedEmail())->toBeTrue();
});

it('rejects an invalid verification hash without verifying the email', function () {
    $user = User::factory()->unverified()->create();

    $url = URL::temporarySignedRoute(
        'verification.verify',
        now()->addMinutes(60),
        ['id' => $user->id, 'hash' => sha1('wrong-email')]
    );

    $response = $this->get($url);

    $response->assertRedirect();
    expect($response->headers->get('Location'))->toContain('/login?verified=0');

    expect($user->fresh()->hasVerifiedEmail())->toBeFalse();
});

it('rejects a tampered or expired signature', function () {
    $user = User::factory()->unverified()->create();

    $url = URL::temporarySignedRoute(
        'verification.verify',
        now()->subMinutes(60),
        ['id' => $user->id, 'hash' => sha1($user->email)]
    );

    $this->get($url)->assertForbidden();

    expect($user->fresh()->hasVerifiedEmail())->toBeFalse();
});

it('throttles resending the verification email', function () {
    Notification::fake();

    $user = User::factory()->unverified()->create();

    for ($i = 0; $i < 6; $i++) {
        $this->actingAs($user)->postJson('/api/email/verification-notification');
    }

    $this->actingAs($user)
        ->postJson('/api/email/verification-notification')
        ->assertStatus(429);

    Notification::assertSentToTimes($user, VerifyEmail::class, 6);
});
