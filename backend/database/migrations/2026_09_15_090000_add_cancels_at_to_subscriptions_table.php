<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('subscriptions', function (Blueprint $table) {
            // When a Stripe subscription is set to "cancel at period end":
            // the effective date it will actually stop. The subscription
            // stays Active (full access) until then. Null means no
            // cancellation is scheduled. Distinct from `canceled_at`, which
            // is when a cancellation was *requested*.
            $table->timestamp('cancels_at')->nullable()->after('canceled_at');
        });
    }

    public function down(): void
    {
        Schema::table('subscriptions', function (Blueprint $table) {
            $table->dropColumn('cancels_at');
        });
    }
};
