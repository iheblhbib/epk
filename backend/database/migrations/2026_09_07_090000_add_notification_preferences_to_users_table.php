<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // Null means "no overrides yet" — every kind/channel defaults to
            // enabled (see User::wantsNotificationChannel()), so this column
            // only ever needs to record the toggles a user actually flipped
            // off, not the full schema for every user up front.
            $table->json('notification_preferences')->nullable()->after('locale');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('notification_preferences');
        });
    }
};
