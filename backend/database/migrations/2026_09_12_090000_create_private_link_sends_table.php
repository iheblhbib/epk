<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('private_link_sends', function (Blueprint $table) {
            $table->id();
            $table->foreignId('private_link_id')->constrained()->cascadeOnDelete();
            $table->foreignId('sent_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('recipient_email');
            $table->string('recipient_name')->nullable();
            $table->text('message')->nullable();
            // Whether the link's password was written into the share email —
            // recorded so the sender can see, later, whether a given recipient
            // got a self-contained link or needs the password separately.
            $table->boolean('included_password')->default(false);
            // Sends are an append-only log, like audit_logs — no updated_at.
            $table->timestamp('created_at')->nullable();

            $table->index(['private_link_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('private_link_sends');
    }
};
