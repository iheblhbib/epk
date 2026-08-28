<?php

namespace Database\Factories;

use App\Enums\AnalyticsEventType;
use App\Enums\DeviceType;
use App\Models\AnalyticsEvent;
use App\Models\Epk;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<AnalyticsEvent>
 */
class AnalyticsEventFactory extends Factory
{
    public function definition(): array
    {
        return [
            'epk_id' => Epk::factory(),
            'type' => AnalyticsEventType::PageView,
            'visitor_hash' => hash('sha256', fake()->uuid()),
            'referrer_host' => fake()->randomElement(['google.com', 'instagram.com', null]),
            'country' => fake()->randomElement(['US', 'GB', 'FR', null]),
            'device_type' => fake()->randomElement(DeviceType::cases()),
            'browser' => fake()->randomElement(['Chrome', 'Safari', 'Firefox']),
            'os' => fake()->randomElement(['Windows', 'macOS', 'iOS', 'Android']),
            'created_at' => now(),
        ];
    }

    public function type(AnalyticsEventType $type): static
    {
        return $this->state(['type' => $type]);
    }

    public function onDate(\DateTimeInterface $date): static
    {
        return $this->state(['created_at' => $date]);
    }
}
