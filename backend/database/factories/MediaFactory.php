<?php

namespace Database\Factories;

use App\Enums\MediaType;
use App\Models\Media;
use App\Models\Workspace;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<Media>
 */
class MediaFactory extends Factory
{
    public function definition(): array
    {
        $type = fake()->randomElement(MediaType::cases());
        $extension = match ($type) {
            MediaType::Image => 'jpg',
            MediaType::Audio => 'mp3',
            MediaType::Video => 'mp4',
            MediaType::Document => 'pdf',
        };
        $filename = Str::random(40).'.'.$extension;

        return [
            'workspace_id' => Workspace::factory(),
            'disk' => 'public',
            'filename' => $filename,
            'original_filename' => fake()->words(2, true).'.'.$extension,
            'path' => "workspaces/1/media/{$type->value}/{$filename}",
            'mime_type' => match ($type) {
                MediaType::Image => 'image/jpeg',
                MediaType::Audio => 'audio/mpeg',
                MediaType::Video => 'video/mp4',
                MediaType::Document => 'application/pdf',
            },
            'type' => $type,
            'size' => fake()->numberBetween(1000, 5_000_000),
        ];
    }

    public function image(): static
    {
        return $this->state(function (array $attributes) {
            $filename = Str::random(40).'.jpg';

            return [
                'type' => MediaType::Image,
                'filename' => $filename,
                'original_filename' => fake()->word().'.jpg',
                'path' => "workspaces/1/media/image/{$filename}",
                'mime_type' => 'image/jpeg',
                'metadata' => ['width' => 1200, 'height' => 800],
            ];
        });
    }
}
