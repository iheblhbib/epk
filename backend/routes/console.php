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

// Safety net for any Stripe webhook that never landed — re-pulls
// subscription state straight from Stripe. Idempotent.
Schedule::command('billing:reconcile')->dailyAt('06:00');

// Heads-up ~7 days before an annual subscription's yearly charge.
Schedule::command('billing:renewal-reminders')->dailyAt('06:30');

// Engagement emails — all opt-out-able (notification_preferences), unlike
// the billing/trial ones above. Same single `schedule:run` cron drives them.
Schedule::command('epks:draft-nudge')->dailyAt('08:00');
Schedule::command('epks:view-milestones')->dailyAt('08:15');
Schedule::command('digest:weekly')->weeklyOn(1, '08:30');
