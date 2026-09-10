<?php

use App\Models\User;
use App\Notifications\EmailChangeNotification;
use App\Notifications\PasswordChangedNotification;
use App\Notifications\TwoFactorAuthenticationChangedNotification;
use Illuminate\Auth\Notifications\VerifyEmail;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Password;
use PragmaRX\Google2FA\Google2FA;

it('emails the user when their password is changed from settings', function () {
    Notification::fake();
    $user = User::factory()->create(['password' => bcrypt('old-password123')]);

    $this->actingAs($user)->putJson('/api/user/password', [
        'current_password' => 'old-password123',
        'password' => 'NewPassword123!',
        'password_confirmation' => 'NewPassword123!',
    ])->assertOk();

    Notification::assertSentTo($user, PasswordChangedNotification::class);
});

it('emails the user when their password is reset through the reset-link flow', function () {
    Notification::fake();
    $user = User::factory()->create();
    $token = Password::createToken($user);

    $this->postJson('/api/reset-password', [
        'token' => $token,
        'email' => $user->email,
        'password' => 'NewPassword123!',
        'password_confirmation' => 'NewPassword123!',
    ])->assertOk();

    Notification::assertSentTo($user, PasswordChangedNotification::class);
});

it('emails the old address when the account email is changed, and verifies the new one', function () {
    Notification::fake();
    $user = User::factory()->create(['email' => 'old@example.com']);

    $this->actingAs($user)->putJson('/api/user/profile', [
        'name' => $user->name,
        'email' => 'new@example.com',
    ])->assertOk();

    Notification::assertSentOnDemand(
        EmailChangeNotification::class,
        fn ($notification, $channels, $notifiable) => $notifiable->routes['mail'] === 'old@example.com'
    );
    Notification::assertSentTo($user, VerifyEmail::class);
});

it('does not send an email-change alert when the profile update leaves the email untouched', function () {
    Notification::fake();
    $user = User::factory()->create(['email' => 'stable@example.com']);

    $this->actingAs($user)->putJson('/api/user/profile', [
        'name' => 'Renamed',
        'email' => 'stable@example.com',
    ])->assertOk();

    Notification::assertNothingSent();
});

it('emails the user when two-factor authentication is enabled', function () {
    Notification::fake();
    $user = User::factory()->create(['password' => bcrypt('password123')]);

    $secret = $this->actingAs($user)
        ->postJson('/api/user/two-factor-authentication', ['current_password' => 'password123'])
        ->json('data.secret');
    $this->actingAs($user)
        ->postJson('/api/user/confirmed-two-factor-authentication', ['code' => (new Google2FA)->getCurrentOtp($secret)])
        ->assertOk();

    Notification::assertSentTo(
        $user,
        TwoFactorAuthenticationChangedNotification::class,
        fn ($notification) => $notification->enabled === true
    );
});

it('emails the user when two-factor authentication is disabled', function () {
    $user = User::factory()->create(['password' => bcrypt('password123')]);
    $secret = $this->actingAs($user)
        ->postJson('/api/user/two-factor-authentication', ['current_password' => 'password123'])
        ->json('data.secret');
    $this->actingAs($user)
        ->postJson('/api/user/confirmed-two-factor-authentication', ['code' => (new Google2FA)->getCurrentOtp($secret)])
        ->assertOk();

    Notification::fake();

    $this->actingAs($user)
        ->deleteJson('/api/user/two-factor-authentication', ['current_password' => 'password123'])
        ->assertOk();

    Notification::assertSentTo(
        $user,
        TwoFactorAuthenticationChangedNotification::class,
        fn ($notification) => $notification->enabled === false
    );
});
