<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    // Deliberately NOT WithoutModelEvents (Laravel's own default scaffold,
    // never actually needed here): three models rely on a `creating`/
    // `created` model event to fill in data a plain factory definition
    // doesn't — Epk's uuid, PrivateLink's token, and (since Phase 13)
    // Workspace's auto-provisioned Subscription row. Disabling events during
    // seeding silently skipped all three; nothing in this seeder needs
    // events suppressed (no model here listens for one to send a
    // notification or other side effect), so there's no tradeoff in leaving
    // them on.

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        $demoUser = User::factory()->create([
            'name' => 'Demo User',
            'email' => 'demo@kitfolio.test',
            'password' => bcrypt('password'),
            'email_verified_at' => now(),
        ]);

        $this->call(WorkspaceSeeder::class, false, ['owner' => $demoUser]);
    }
}
