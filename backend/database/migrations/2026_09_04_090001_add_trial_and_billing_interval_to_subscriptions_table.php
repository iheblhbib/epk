<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('subscriptions', function (Blueprint $table) {
            // Set once, at workspace creation, to created_at + 14 days --
            // see Workspace::booted(). Read by the access-gate middleware
            // to decide whether a Trialing subscription still has access.
            $table->timestamp('trial_ends_at')->nullable()->after('status');
            // Populated only once a real paid Stripe subscription exists
            // (see StripeBillingService::syncFromStripeSubscription()) --
            // stays null throughout the trial.
            $table->string('billing_interval', 10)->nullable()->after('trial_ends_at');
        });
    }

    public function down(): void
    {
        Schema::table('subscriptions', function (Blueprint $table) {
            $table->dropColumn(['trial_ends_at', 'billing_interval']);
        });
    }
};
