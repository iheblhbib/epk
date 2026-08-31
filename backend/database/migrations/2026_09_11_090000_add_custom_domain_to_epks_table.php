<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('epks', function (Blueprint $table) {
            // Globally unique — a domain can only ever point at one EPK,
            // the same way a slug can only ever belong to one.
            $table->string('custom_domain')->nullable()->unique()->after('slug');
            // The value the owner is asked to publish in a
            // _kitfolio-challenge TXT record to prove they control the
            // domain — see EpkCustomDomainController::verify(). Cleared
            // (and re-generated) whenever the domain itself changes, so an
            // old proof can never verify a newly-claimed domain.
            $table->string('custom_domain_token')->nullable()->after('custom_domain');
            // Null until verify() finds a matching TXT record — an
            // unverified domain is never resolved publicly (see
            // PublicEpkController::showByDomain()), so simply typing in
            // someone else's live domain here does nothing.
            $table->timestamp('custom_domain_verified_at')->nullable()->after('custom_domain_token');
        });
    }

    public function down(): void
    {
        Schema::table('epks', function (Blueprint $table) {
            $table->dropColumn(['custom_domain', 'custom_domain_token', 'custom_domain_verified_at']);
        });
    }
};
