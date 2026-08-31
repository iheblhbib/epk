<?php

use App\Models\User;
use Illuminate\Support\Facades\Auth;
use PragmaRX\Google2FA\Google2FA;

function currentOtpFor(string $secret): string
{
    return (new Google2FA)->getCurrentOtp($secret);
}

it('requires the current password to start enabling two-factor authentication', function () {
    $user = User::factory()->create(['password' => bcrypt('password123')]);

    $this->actingAs($user)
        ->postJson('/api/user/two-factor-authentication', ['current_password' => 'wrong'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('current_password');
});

it('generates a pending secret and otpauth url', function () {
    $user = User::factory()->create(['password' => bcrypt('password123')]);

    $response = $this->actingAs($user)
        ->postJson('/api/user/two-factor-authentication', ['current_password' => 'password123'])
        ->assertOk();

    expect($response->json('data.secret'))->toBeString()->not->toBeEmpty();
    expect($response->json('data.otpauth_url'))->toContain('otpauth://totp/')
        ->and($response->json('data.otpauth_url'))->toContain(urlencode($user->email));

    // Not yet enabled — a secret exists, but nothing has confirmed it.
    expect($user->fresh()->hasEnabledTwoFactorAuthentication())->toBeFalse();
});

it('confirms with a valid code, enabling 2FA and issuing recovery codes', function () {
    $user = User::factory()->create(['password' => bcrypt('password123')]);
    $secret = $this->actingAs($user)
        ->postJson('/api/user/two-factor-authentication', ['current_password' => 'password123'])
        ->json('data.secret');

    $response = $this->actingAs($user)
        ->postJson('/api/user/confirmed-two-factor-authentication', ['code' => currentOtpFor($secret)])
        ->assertOk();

    $codes = $response->json('data');
    expect($codes)->toBeArray()->and(count($codes))->toBe(8);
    expect($user->fresh()->hasEnabledTwoFactorAuthentication())->toBeTrue();
});

it('rejects confirmation with an invalid code', function () {
    $user = User::factory()->create(['password' => bcrypt('password123')]);
    $this->actingAs($user)->postJson('/api/user/two-factor-authentication', ['current_password' => 'password123']);

    $this->actingAs($user)
        ->postJson('/api/user/confirmed-two-factor-authentication', ['code' => '000000'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('code');

    expect($user->fresh()->hasEnabledTwoFactorAuthentication())->toBeFalse();
});

it('rejects confirmation when setup was never started', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->postJson('/api/user/confirmed-two-factor-authentication', ['code' => '123456'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('code');
});

function enableTwoFactorFor(User $user): array
{
    $secret = test()->actingAs($user)
        ->postJson('/api/user/two-factor-authentication', ['current_password' => 'password123'])
        ->json('data.secret');

    $recoveryCodes = test()->actingAs($user)
        ->postJson('/api/user/confirmed-two-factor-authentication', ['code' => currentOtpFor($secret)])
        ->json('data');

    return [$secret, $recoveryCodes];
}

it('requires a second step at login once two-factor is enabled', function () {
    $user = User::factory()->create(['password' => bcrypt('password123')]);
    enableTwoFactorFor($user);

    $response = $this->postJson('/api/login', ['email' => $user->email, 'password' => 'password123'])
        ->assertOk();

    expect($response->json('data.two_factor_required'))->toBeTrue();
    // The password step alone must never leave the browser authenticated.
    $this->assertGuest('web');
});

it('completes login with a valid totp code after the password step', function () {
    $user = User::factory()->create(['password' => bcrypt('password123')]);
    [$secret] = enableTwoFactorFor($user);

    $this->postJson('/api/login', ['email' => $user->email, 'password' => 'password123'])->assertOk();

    $this->postJson('/api/two-factor-challenge', ['code' => currentOtpFor($secret)])
        ->assertOk()
        ->assertJsonPath('data.email', $user->email);

    $this->assertAuthenticatedAs($user);
});

it('rejects an invalid code at the two-factor challenge and never authenticates', function () {
    $user = User::factory()->create(['password' => bcrypt('password123')]);
    enableTwoFactorFor($user);

    $this->postJson('/api/login', ['email' => $user->email, 'password' => 'password123'])->assertOk();

    $this->postJson('/api/two-factor-challenge', ['code' => '000000'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('code');

    $this->assertGuest('web');
});

it('completes login with a recovery code, which is then burned', function () {
    $user = User::factory()->create(['password' => bcrypt('password123')]);
    [, $recoveryCodes] = enableTwoFactorFor($user);
    $code = $recoveryCodes[0];

    $this->postJson('/api/login', ['email' => $user->email, 'password' => 'password123'])->assertOk();
    $this->postJson('/api/two-factor-challenge', ['recovery_code' => $code])->assertOk();
    $this->assertAuthenticatedAs($user);

    // Single-use: the very same recovery code can't complete a second login.
    Auth::guard('web')->logout();
    $this->postJson('/api/login', ['email' => $user->email, 'password' => 'password123'])->assertOk();
    $this->postJson('/api/two-factor-challenge', ['recovery_code' => $code])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('code');
});

it('rejects a two-factor challenge with no pending login in the session', function () {
    $this->postJson('/api/two-factor-challenge', ['code' => '123456'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('code');
});

it('lets a user view and regenerate their recovery codes', function () {
    $user = User::factory()->create(['password' => bcrypt('password123')]);
    [, $originalCodes] = enableTwoFactorFor($user);

    $this->actingAs($user)->getJson('/api/user/two-factor-recovery-codes')
        ->assertOk()
        ->assertJsonCount(8, 'data');

    $response = $this->actingAs($user)->postJson('/api/user/two-factor-recovery-codes')->assertOk();
    $newCodes = $response->json('data');

    expect($newCodes)->toBeArray()->and(count($newCodes))->toBe(8);
    expect(array_intersect($originalCodes, $newCodes))->toBeEmpty();
});

it('requires the current password to disable two-factor authentication', function () {
    $user = User::factory()->create(['password' => bcrypt('password123')]);
    enableTwoFactorFor($user);

    $this->actingAs($user)
        ->deleteJson('/api/user/two-factor-authentication', ['current_password' => 'wrong'])
        ->assertUnprocessable();

    expect($user->fresh()->hasEnabledTwoFactorAuthentication())->toBeTrue();
});

it('disables two-factor authentication, after which login no longer requires a second step', function () {
    $user = User::factory()->create(['password' => bcrypt('password123')]);
    enableTwoFactorFor($user);

    $this->actingAs($user)
        ->deleteJson('/api/user/two-factor-authentication', ['current_password' => 'password123'])
        ->assertOk();

    expect($user->fresh()->hasEnabledTwoFactorAuthentication())->toBeFalse();

    Auth::guard('web')->logout();
    $this->postJson('/api/login', ['email' => $user->email, 'password' => 'password123'])
        ->assertOk()
        ->assertJsonPath('data.email', $user->email);
});
