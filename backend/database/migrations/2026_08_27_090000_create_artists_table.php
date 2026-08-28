<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('artists', function (Blueprint $table) {
            $table->id();
            $table->foreignId('workspace_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('stage_name')->nullable();
            $table->text('short_bio')->nullable();
            $table->string('country')->nullable();
            $table->string('city')->nullable();
            $table->string('genre')->nullable();
            $table->string('website')->nullable();
            $table->string('booking_email')->nullable();
            $table->string('press_email')->nullable();
            $table->string('management_email')->nullable();
            $table->string('profile_image_path')->nullable();
            $table->string('cover_image_path')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['workspace_id', 'name']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('artists');
    }
};
