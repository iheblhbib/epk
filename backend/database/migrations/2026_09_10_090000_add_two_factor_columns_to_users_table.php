<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // Encrypted (reversible), not hashed: unlike a password, the
            // secret and recovery codes must be readable again later — to
            // verify a submitted TOTP code against the secret, and to let a
            // user view their still-unused recovery codes on demand.
            $table->text('two_factor_secret')->nullable()->after('notification_preferences');
            $table->text('two_factor_recovery_codes')->nullable()->after('two_factor_secret');
            // Null while a secret has been generated but not yet verified
            // with a real code from the authenticator app — see
            // TwoFactorAuthenticationController::confirm(). Only a
            // confirmed secret is ever checked at login, so an abandoned
            // "scan this QR code" step never locks anyone out.
            $table->timestamp('two_factor_confirmed_at')->nullable()->after('two_factor_recovery_codes');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['two_factor_secret', 'two_factor_recovery_codes', 'two_factor_confirmed_at']);
        });
    }
};
