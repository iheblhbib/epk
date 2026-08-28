<?php

namespace Database\Factories;

use App\Models\Artist;
use App\Models\Workspace;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Artist>
 */
class ArtistFactory extends Factory
{
    public function definition(): array
    {
        return [
            'workspace_id' => Workspace::factory(),
            'name' => fake()->name(),
            'stage_name' => fake()->optional()->userName(),
            'short_bio' => fake()->optional()->sentence(20),
            'country' => fake()->optional()->country(),
            'city' => fake()->optional()->city(),
            'genre' => fake()->optional()->randomElement(['Pop', 'Rock', 'Hip-Hop', 'Electronic', 'Jazz', 'Folk']),
            'website' => fake()->optional()->url(),
            'booking_email' => fake()->optional()->safeEmail(),
            'press_email' => fake()->optional()->safeEmail(),
            'management_email' => fake()->optional()->safeEmail(),
        ];
    }
}
