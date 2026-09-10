<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('subscriptions', function (Blueprint $table) {
            // When the "your annual plan renews soon" reminder was last sent
            // for the current billing period. Cleared whenever
            // current_period_ends_at moves forward (a renewal happened), so
            // each yearly period gets exactly one reminder. Null for monthly
            // plans — they're not reminded.
            $table->timestamp('renewal_reminded_at')->nullable()->after('trial_reminder_stage');
        });
    }

    public function down(): void
    {
        Schema::table('subscriptions', function (Blueprint $table) {
            $table->dropColumn('renewal_reminded_at');
        });
    }
};
