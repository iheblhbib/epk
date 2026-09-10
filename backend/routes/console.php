<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Trial-ending / trial-ended reminder emails. Needs the one cron entry
// documented in docs/cpanel-deployment.md ("* * * * * php artisan
// schedule:run") to actually be running on the host. Runs once a day; the
// command itself is idempotent (trial_reminder_stage), so a double-run or
// a missed day is harmless.
Schedule::command('billing:trial-reminders')->dailyAt('07:00');
