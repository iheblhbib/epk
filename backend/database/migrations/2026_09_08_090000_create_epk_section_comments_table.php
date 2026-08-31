<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('epk_section_comments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('epk_section_id')->constrained()->cascadeOnDelete();
            // nullOnDelete, not cascade: a comment is workspace-collaboration
            // history for the section, not a possession of the account that
            // wrote it — deleting a user's account (a separate, rarer event
            // than leaving a workspace) shouldn't erase what was said in a
            // review thread, just anonymize who said it.
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->text('body');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('epk_section_comments');
    }
};
