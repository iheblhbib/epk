<?php

namespace Database\Factories;

use App\Enums\SectionType;
use App\Models\Epk;
use App\Models\EpkSection;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<EpkSection>
 */
class EpkSectionFactory extends Factory
{
    public function definition(): array
    {
        $type = fake()->randomElement(array_filter(
            SectionType::cases(),
            fn (SectionType $type) => ! $type->isSingleton()
        ));

        return [
            'epk_id' => Epk::factory(),
            'type' => $type,
            'title' => null,
            'is_enabled' => true,
            'position' => fake()->numberBetween(0, 10),
            'config' => $type->defaultConfig(),
        ];
    }

    public function hero(): static
    {
        return $this->state(fn (array $attributes) => [
            'type' => SectionType::Hero,
            'config' => SectionType::Hero->defaultConfig(),
        ]);
    }

    public function biography(): static
    {
        return $this->state(fn (array $attributes) => [
            'type' => SectionType::Biography,
            'config' => ['html' => '<p>Bio</p>'],
        ]);
    }
}
