<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('epk_sections', function (Blueprint $table) {
            $table->id();
            $table->foreignId('epk_id')->constrained()->cascadeOnDelete();
            $table->string('type', 30);
            $table->string('title')->nullable();
            $table->boolean('is_enabled')->default(true);
            $table->unsignedInteger('position')->default(0);
            $table->json('config')->nullable();
            $table->timestamps();

            $table->index(['epk_id', 'position']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('epk_sections');
    }
};
