<?php

use App\Enums\Locale;
use App\Models\User;

it('defaults a new user to english', function () {
    $user = User::factory()->create();

    expect($user->locale)->toBe(Locale::English);
});

it('lets a user update their locale preference', function () {
    $user = User::factory()->create();

    $this->actingAs($user)->putJson('/api/user/locale', ['locale' => 'fr'])
        ->assertOk()
        ->assertJsonPath('data.locale', 'fr');

    expect($user->fresh()->locale)->toBe(Locale::French);
});

it('rejects an unsupported locale', function () {
    $user = User::factory()->create();

    $this->actingAs($user)->putJson('/api/user/locale', ['locale' => 'xx'])->assertUnprocessable();
});

it("responds with an authenticated user's saved locale for validation errors", function () {
    $user = User::factory()->create(['locale' => Locale::French]);

    $response = $this->actingAs($user)->putJson('/api/user/profile', ['name' => '', 'email' => 'not-an-email']);

    $response->assertUnprocessable();
    // A French required-field message from the laravel-lang/lang package,
    // proving SetLocaleFromUser actually switched the app locale before
    // validation ran — not just that the request happened to succeed.
    expect($response->json('errors.name.0'))->toContain('champ');
});

it('falls back to the Accept-Language header for a guest request', function () {
    $response = $this->withHeaders(['Accept-Language' => 'fr'])
        ->postJson('/api/login', ['email' => 'nobody@example.com', 'password' => 'wrong']);

    $response->assertUnprocessable();
    expect($response->json('errors.email.0'))->not->toBe('These credentials do not match our records.');
});

it('lets an admin see the platform-wide locale is otherwise unaffected by another user\'s preference', function () {
    // Regression guard for the "global middleware order" risk: one user's
    // saved locale must never leak into a different, unauthenticated
    // request's response.
    User::factory()->create(['locale' => Locale::French]);

    $response = $this->postJson('/api/login', ['email' => 'nobody@example.com', 'password' => 'wrong']);

    $response->assertUnprocessable();
    expect($response->json('errors.email.0'))->toBe('These credentials do not match our records.');
});
