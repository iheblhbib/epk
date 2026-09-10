<?php

namespace Database\Factories;

use App\Models\PrivateLink;
use App\Models\PrivateLinkSend;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<PrivateLinkSend>
 */
class PrivateLinkSendFactory extends Factory
{
    public function definition(): array
    {
        return [
            'private_link_id' => PrivateLink::factory(),
            'sent_by' => User::factory(),
            'recipient_email' => fake()->safeEmail(),
            'recipient_name' => fake()->name(),
            'message' => null,
            'included_password' => false,
            'created_at' => now(),
        ];
    }
}
