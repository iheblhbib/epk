<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('private_links', function (Blueprint $table) {
            $table->id();
            $table->foreignId('epk_id')->constrained()->cascadeOnDelete();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            // High-entropy and unguessable by design — unlike an EPK's public
            // slug, this token is the only thing standing between "revealed
            // to nobody" and "revealed to whoever holds the link", so it's
            // generated with Str::random(40), not a slug of anything human-chosen.
            $table->string('token', 64)->unique();
            $table->string('label')->nullable();
            $table->string('password_hash')->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->timestamp('revoked_at')->nullable();
            $table->unsignedInteger('view_count')->default(0);
            $table->timestamp('last_viewed_at')->nullable();
            $table->timestamps();

            $table->index(['epk_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('private_links');
    }
};
