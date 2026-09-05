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
        // Every type is a singleton now (isSingleton() is unconditionally
        // true), so there's no meaningful "non-singleton" subset left to
        // filter down to -- just pick any type. Nothing here relies on
        // multiple same-type sections coexisting on one Epk; callers that
        // need a specific type already use hero()/biography() below or set
        // 'type' explicitly.
        $type = fake()->randomElement(SectionType::cases());

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
