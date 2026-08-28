<?php

use App\Models\User;

it('updates the authenticated user profile', function () {
    $user = User::factory()->create(['name' => 'Old Name']);

    $this->actingAs($user)
        ->putJson('/api/user/profile', [
            'name' => 'New Name',
            'email' => $user->email,
        ])
        ->assertOk()
        ->assertJsonPath('data.name', 'New Name');

    expect($user->fresh()->name)->toBe('New Name');
});

it('requires an unverified re-check when the email changes', function () {
    $user = User::factory()->create(['email' => 'old@example.com']);

    $this->actingAs($user)
        ->putJson('/api/user/profile', [
            'name' => $user->name,
            'email' => 'new@example.com',
        ])
        ->assertOk();

    expect($user->fresh())
        ->email->toBe('new@example.com')
        ->hasVerifiedEmail()->toBeFalse();
});

it('requires the current password to change password', function () {
    $user = User::factory()->create(['password' => bcrypt('old-password123')]);

    $this->actingAs($user)
        ->putJson('/api/user/password', [
            'current_password' => 'wrong-password',
            'password' => 'NewPassword123!',
            'password_confirmation' => 'NewPassword123!',
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('current_password');

    $this->actingAs($user)
        ->putJson('/api/user/password', [
            'current_password' => 'old-password123',
            'password' => 'NewPassword123!',
            'password_confirmation' => 'NewPassword123!',
        ])
        ->assertOk();

    $this->postJson('/api/login', [
        'email' => $user->email,
        'password' => 'NewPassword123!',
    ])->assertOk();
});
