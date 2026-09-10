<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('epks', function (Blueprint $table) {
            // Set once, when the "your EPK is still a draft" nudge email
            // goes out at the 7-day mark. Never nudged again after that.
            $table->timestamp('draft_nudged_at')->nullable()->after('published_at');
            // The highest page-view milestone already announced by email
            // for this EPK (0 -> 100 -> 500 -> 1000 -> ...). The daily
            // `epks:view-milestones` command only announces thresholds
            // above this, then bumps it.
            $table->unsignedInteger('last_view_milestone')->default(0)->after('draft_nudged_at');
        });
    }

    public function down(): void
    {
        Schema::table('epks', function (Blueprint $table) {
            $table->dropColumn(['draft_nudged_at', 'last_view_milestone']);
        });
    }
};
