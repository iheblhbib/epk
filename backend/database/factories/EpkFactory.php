<?php

namespace Database\Factories;

use App\Enums\EpkStatus;
use App\Models\Artist;
use App\Models\Epk;
use App\Models\Workspace;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<Epk>
 */
class EpkFactory extends Factory
{
    public function definition(): array
    {
        $title = fake()->words(3, true);

        return [
            'workspace_id' => Workspace::factory(),
            'artist_id' => Artist::factory(),
            'title' => $title,
            'slug' => Str::slug($title).'-'.fake()->unique()->numberBetween(1, 999999),
            'status' => EpkStatus::Draft,
            'theme' => 'minimal',
        ];
    }

    public function published(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => EpkStatus::Published,
            'published_at' => now(),
        ]);
    }

    public function archived(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => EpkStatus::Archived,
        ]);
    }
}
