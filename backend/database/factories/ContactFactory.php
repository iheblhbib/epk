<?php

namespace Database\Factories;

use App\Enums\ContactCategory;
use App\Models\Contact;
use App\Models\Workspace;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Contact>
 */
class ContactFactory extends Factory
{
    public function definition(): array
    {
        return [
            'workspace_id' => Workspace::factory(),
            'name' => fake()->name(),
            'email' => fake()->safeEmail(),
            'phone' => fake()->phoneNumber(),
            'category' => fake()->randomElement(ContactCategory::cases()),
            'organization' => fake()->company(),
            'notes' => fake()->boolean(40) ? fake()->sentence() : null,
        ];
    }

    public function category(ContactCategory $category): static
    {
        return $this->state(['category' => $category]);
    }
}
