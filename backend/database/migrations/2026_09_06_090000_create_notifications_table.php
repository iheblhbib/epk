<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Laravel's standard database-notifications shape (matches
     * `php artisan notifications:table`'s stub) — a generic, polymorphic
     * store so any future notification type (comments, milestones, admin
     * alerts, ...) reuses this same table/model/API instead of each type
     * needing its own. `data` holds a JSON payload per notification class;
     * `notifiable` is who it belongs to (always a User for now).
     */
    public function up(): void
    {
        Schema::create('notifications', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('type');
            $table->morphs('notifiable');
            $table->text('data');
            $table->timestamp('read_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('notifications');
    }
};
