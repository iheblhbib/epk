<?php

use App\Models\User;

it('lists only the authenticated user\'s own tokens', function () {
    $user = User::factory()->create();
    $otherUser = User::factory()->create();
    $user->createToken('My laptop');
    $otherUser->createToken('Not mine');

    $response = $this->actingAs($user)->getJson('/api/user/api-tokens')->assertOk();

    $names = collect($response->json('data'))->pluck('name')->values()->all();
    expect($names)->toBe(['My laptop']);
});

it('creates a token, returning the plaintext value once', function () {
    $user = User::factory()->create();

    $response = $this->actingAs($user)->postJson('/api/user/api-tokens', ['name' => 'CI script'])
        ->assertCreated();

    $response->assertJsonPath('data.name', 'CI script');
    $plainTextToken = $response->json('data.plain_text_token');
    expect($plainTextToken)->toBeString()->not->toBeEmpty();

    // The plaintext value is never persisted or returned again — only the
    // hash lives in the database, and index() doesn't expose it at all.
    $this->assertDatabaseMissing('personal_access_tokens', ['token' => $plainTextToken]);
    $listing = $this->actingAs($user)->getJson('/api/user/api-tokens')->assertOk();
    expect($listing->json('data.0'))->not->toHaveKey('plain_text_token');
});

it('authenticates a real request using the freshly issued token', function () {
    $user = User::factory()->create();
    // Issued directly on the model, deliberately not through an
    // actingAs()-authenticated HTTP call: actingAs() sets the session
    // guard's user for the rest of the test regardless of request headers,
    // which would let the assertion below pass even if Bearer auth were
    // broken. This is the only way to test the token in isolation.
    $plainTextToken = $user->createToken('CI script')->plainTextToken;

    $this->withHeader('Authorization', "Bearer {$plainTextToken}")
        ->getJson('/api/user')
        ->assertOk()
        ->assertJsonPath('data.id', $user->id);
});

it('revokes a token via the endpoint, removing it from the database', function () {
    $user = User::factory()->create();
    $plainTextToken = $user->createToken('CI script')->plainTextToken;
    $tokenId = $user->tokens()->first()->id;

    $this->withHeader('Authorization', "Bearer {$plainTextToken}")
        ->deleteJson("/api/user/api-tokens/{$tokenId}")
        ->assertOk();

    $this->assertDatabaseMissing('personal_access_tokens', ['id' => $tokenId]);
});

it('rejects a request made with a token that no longer exists', function () {
    $user = User::factory()->create();
    $plainTextToken = $user->createToken('CI script')->plainTextToken;
    // Deleted directly, rather than via a prior HTTP call in this same
    // test: Sanctum's guard caches the resolved user on itself once
    // authenticated, and that cache would otherwise outlive a same-test
    // DELETE request and make this assertion pass for the wrong reason.
    $user->tokens()->delete();

    $this->withHeader('Authorization', "Bearer {$plainTextToken}")
        ->getJson('/api/user')
        ->assertUnauthorized();
});

it('never lets a user revoke someone else\'s token', function () {
    $user = User::factory()->create();
    $otherUser = User::factory()->create();
    $otherToken = $otherUser->createToken('Not yours')->accessToken;

    $this->actingAs($user)
        ->deleteJson("/api/user/api-tokens/{$otherToken->id}")
        ->assertNotFound();

    $this->assertDatabaseHas('personal_access_tokens', ['id' => $otherToken->id]);
});

describe('when the feature flag is off', function () {
    beforeEach(fn () => config(['features.api_tokens' => false]));

    it('404s listing tokens, even for a normally-authenticated SPA session', function () {
        $user = User::factory()->create();

        $this->actingAs($user)->getJson('/api/user/api-tokens')->assertNotFound();
    });

    it('404s creating a token, even for a normally-authenticated SPA session', function () {
        $user = User::factory()->create();

        $this->actingAs($user)->postJson('/api/user/api-tokens', ['name' => 'CI script'])->assertNotFound();
    });

    it('rejects every API call authenticated with an already-issued token, not just token-management ones', function () {
        $user = User::factory()->create();
        $plainTextToken = $user->createToken('CI script')->plainTextToken;

        $this->withHeader('Authorization', "Bearer {$plainTextToken}")
            ->getJson('/api/user')
            ->assertUnauthorized();
    });

    it('still lets a user revoke an already-issued token', function () {
        $user = User::factory()->create();
        $tokenId = $user->createToken('CI script')->accessToken->id;

        $this->actingAs($user)
            ->deleteJson("/api/user/api-tokens/{$tokenId}")
            ->assertOk();

        $this->assertDatabaseMissing('personal_access_tokens', ['id' => $tokenId]);
    });

    it('leaves the SPA\'s own cookie session completely unaffected', function () {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->getJson('/api/user')
            ->assertOk()
            ->assertJsonPath('data.id', $user->id);
    });
});
