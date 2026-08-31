<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Str;
use PragmaRX\Google2FA\Google2FA;

/**
 * Thin wrapper around pragmarx/google2fa (pure-PHP TOTP, no external
 * service or compiled extension — fine on shared cPanel hosting) plus the
 * recovery-code bookkeeping Google2FA itself doesn't provide. The QR code
 * these produce is never rendered server-side: the otpauth:// URI from
 * qrCodeUrl() is handed to the frontend, which draws the actual QR code
 * client-side (see frontend's TwoFactorSetup), keeping this app's only
 * per-user secret decrypt/encrypt on the PHP side.
 */
class TwoFactorAuthenticationService
{
    private Google2FA $engine;

    public function __construct()
    {
        $this->engine = new Google2FA;
    }

    public function generateSecretKey(): string
    {
        return $this->engine->generateSecretKey();
    }

    public function qrCodeUrl(User $user, string $secret): string
    {
        return $this->engine->getQRCodeUrl(
            config('app.name'),
            $user->email,
            $secret,
        );
    }

    public function verify(string $secret, string $code): bool
    {
        return $this->engine->verifyKey($secret, $code);
    }

    /**
     * @return array<int, string>
     */
    public function generateRecoveryCodes(): array
    {
        return collect(range(1, 8))
            ->map(fn () => Str::random(10).'-'.Str::random(10))
            ->all();
    }

    /**
     * Checks a submitted recovery code against the user's remaining set and,
     * if it matches, burns it (recovery codes are single-use) by persisting
     * the set with that one removed.
     */
    public function useRecoveryCode(User $user, string $code): bool
    {
        $codes = $user->two_factor_recovery_codes ?? [];
        $index = array_search($code, $codes, true);

        if ($index === false) {
            return false;
        }

        unset($codes[$index]);
        $user->forceFill(['two_factor_recovery_codes' => array_values($codes)])->save();

        return true;
    }
}
