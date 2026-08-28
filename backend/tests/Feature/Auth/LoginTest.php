<?php

use App\Models\User;

it('logs in a user with valid credentials', function () {
    $user = User::factory()->create(['password' => bcrypt('password123')]);

    $response = $this->postJson('/api/login', [
        'email' => $user->email,
        'password' => 'password123',
    ]);

    $response->assertOk()->assertJsonPath('data.email', $user->email);
    $this->assertAuthenticatedAs($user);
});

it('rejects login with invalid credentials', function () {
    $user = User::factory()->create(['password' => bcrypt('password123')]);

    $response = $this->postJson('/api/login', [
        'email' => $user->email,
        'password' => 'wrong-password',
    ]);

    $response->assertUnprocessable()->assertJsonValidationErrors('email');
    $this->assertGuest();
});

it('rate limits repeated failed login attempts', function () {
    $user = User::factory()->create(['password' => bcrypt('password123')]);

    for ($i = 0; $i < 5; $i++) {
        $this->postJson('/api/login', [
            'email' => $user->email,
            'password' => 'wrong-password',
        ])->assertUnprocessable();
    }

    $this->postJson('/api/login', [
        'email' => $user->email,
        'password' => 'wrong-password',
    ])->assertStatus(429);
});

it('logs out an authenticated user', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->postJson('/api/logout')
        ->assertOk();

    // Explicit guard: the auth:sanctum middleware that ran for this request sets
    // "sanctum" as the sticky default guard for the rest of the test's app
    // lifecycle, so bare assertGuest() would check the wrong guard.
    $this->assertGuest('web');
});
