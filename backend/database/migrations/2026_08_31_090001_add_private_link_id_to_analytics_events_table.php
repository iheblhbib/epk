<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('analytics_events', function (Blueprint $table) {
            // Null for an ordinary public-page visit; set when the visit
            // came in through a private share link, so the dashboard can
            // break traffic down per link ("top private links").
            $table->foreignId('private_link_id')->nullable()->after('epk_id')
                ->constrained()->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('analytics_events', function (Blueprint $table) {
            $table->dropConstrainedForeignId('private_link_id');
        });
    }
};
