<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('audit_logs', function (Blueprint $table) {
            // Nullable: a global admin action (suspending a user, say) has
            // no workspace to attach to. Set whenever the action happened
            // "inside" a workspace, which is also what lets the same table
            // serve both the admin-panel-wide feed (unfiltered) and each
            // workspace's own member-facing activity feed (filtered to its
            // own workspace_id, see WorkspaceActivityLogController).
            $table->foreignId('workspace_id')->nullable()->after('user_id')->constrained()->cascadeOnDelete();
            $table->index(['workspace_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::table('audit_logs', function (Blueprint $table) {
            $table->dropIndex(['workspace_id', 'created_at']);
            $table->dropConstrainedForeignId('workspace_id');
        });
    }
};
