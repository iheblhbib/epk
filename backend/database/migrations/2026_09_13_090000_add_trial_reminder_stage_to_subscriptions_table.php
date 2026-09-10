<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('subscriptions', function (Blueprint $table) {
            // Which trial-ending reminder email has already gone out for
            // this subscription: null -> '3' (3 days out) -> '1' (1 day
            // out) -> 'ended' (the trial lapsed). The daily
            // `billing:trial-reminders` command only advances it forward,
            // so a re-run or a skipped cron day never double-sends.
            $table->string('trial_reminder_stage', 10)->nullable()->after('billing_interval');
        });
    }

    public function down(): void
    {
        Schema::table('subscriptions', function (Blueprint $table) {
            $table->dropColumn('trial_reminder_stage');
        });
    }
};
