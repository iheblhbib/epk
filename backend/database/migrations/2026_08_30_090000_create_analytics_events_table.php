<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('analytics_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('epk_id')->constrained()->cascadeOnDelete();
            $table->string('type', 20);
            // HMAC(ip + user agent, app key) — never the raw IP. Stable
            // (not date-rotated) so COUNT(DISTINCT visitor_hash) over any
            // date range is a real unique-visitor count.
            $table->string('visitor_hash', 64);
            // Referrer's hostname only (e.g. "google.com"), not the full
            // URL — enough for a "top referrers" breakdown without storing
            // a visitor's exact search query or referring page.
            $table->string('referrer_host', 255)->nullable();
            // Best-effort, zero-external-call: read from a hosting-provided
            // header (Apache mod_geoip2's GEOIP_COUNTRY_CODE, or a CDN's
            // CF-IPCountry) when present. Null if neither is available —
            // this app never calls out to a geolocation service itself.
            $table->string('country', 2)->nullable();
            $table->string('device_type', 20)->nullable();
            $table->string('browser', 100)->nullable();
            $table->string('os', 100)->nullable();
            // e.g. {"filename": "presskit.pdf"} for a download, so "top
            // downloads" can be reported without a second table.
            $table->json('meta')->nullable();
            $table->timestamp('created_at');

            $table->index(['epk_id', 'type', 'created_at']);
            $table->index(['epk_id', 'visitor_hash']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('analytics_events');
    }
};
