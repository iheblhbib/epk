<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('epks', function (Blueprint $table) {
            $table->id();
            $table->uuid()->unique();
            $table->foreignId('workspace_id')->constrained()->cascadeOnDelete();
            // Deliberately not cascadeOnDelete: deleting an artist should never
            // silently wipe out their EPKs. The controller checks for and blocks
            // artist deletion while EPKs still reference them (with a friendly
            // error); this FK is the last-resort safety net if that's bypassed.
            $table->foreignId('artist_id')->constrained()->restrictOnDelete();
            $table->string('title');
            $table->string('slug')->unique();
            $table->string('status', 20)->default('draft');
            $table->string('cover_image_path')->nullable();
            $table->string('theme', 50)->default('minimal');
            $table->json('custom_settings')->nullable();
            $table->string('seo_title')->nullable();
            $table->string('seo_description')->nullable();
            $table->timestamp('published_at')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['workspace_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('epks');
    }
};
