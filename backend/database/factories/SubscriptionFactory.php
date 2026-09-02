<?php

namespace Database\Factories;

use App\Enums\SubscriptionPlan;
use App\Enums\SubscriptionStatus;
use App\Models\Subscription;
use App\Models\Workspace;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Subscription>
 */
class SubscriptionFactory extends Factory
{
    public function definition(): array
    {
        return [
            'workspace_id' => Workspace::factory(),
            'plan' => SubscriptionPlan::Business,
            'status' => SubscriptionStatus::Trialing,
            'trial_ends_at' => now()->addDays(14),
        ];
    }

    public function plan(SubscriptionPlan $plan): static
    {
        return $this->state(['plan' => $plan]);
    }

    /** An active, paying subscription -- past the trial, no longer time-boxed. */
    public function active(): static
    {
        return $this->state([
            'status' => SubscriptionStatus::Active,
            'trial_ends_at' => null,
            'billing_interval' => 'monthly',
        ]);
    }

    /** A trial that already ran out, with nothing paid -- the locked-out state. */
    public function expiredTrial(): static
    {
        return $this->state([
            'status' => SubscriptionStatus::Trialing,
            'trial_ends_at' => now()->subDay(),
        ]);
    }
}
