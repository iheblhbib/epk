<?php

namespace Database\Factories;

use App\Models\Epk;
use App\Models\PrivateLink;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * @extends Factory<PrivateLink>
 */
class PrivateLinkFactory extends Factory
{
    public function definition(): array
    {
        return [
            'epk_id' => Epk::factory(),
            'token' => Str::random(40),
            'label' => fake()->words(2, true),
            // Matches the column's DB-level default explicitly — Eloquent
            // doesn't sync that back into the in-memory model after
            // create(), so callers checking $link->view_count right after
            // would otherwise see null instead of 0.
            'view_count' => 0,
        ];
    }

    public function withPassword(string $password = 'secret-pass'): static
    {
        return $this->state(['password_hash' => Hash::make($password)]);
    }

    public function expired(): static
    {
        return $this->state(['expires_at' => now()->subDay()]);
    }

    public function revoked(): static
    {
        return $this->state(['revoked_at' => now()]);
    }
}
