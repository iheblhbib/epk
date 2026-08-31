<?php

namespace Database\Factories;

use App\Models\EpkSection;
use App\Models\EpkSectionComment;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<EpkSectionComment>
 */
class EpkSectionCommentFactory extends Factory
{
    public function definition(): array
    {
        return [
            'epk_section_id' => EpkSection::factory(),
            'user_id' => User::factory(),
            'body' => fake()->sentence(),
        ];
    }
}
