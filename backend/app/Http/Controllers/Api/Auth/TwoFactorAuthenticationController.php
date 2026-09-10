<?php

namespace App\Http\Controllers\Api\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\ConfirmTwoFactorAuthenticationRequest;
use App\Http\Requests\Auth\DisableTwoFactorAuthenticationRequest;
use App\Http\Requests\Auth\EnableTwoFactorAuthenticationRequest;
use App\Notifications\TwoFactorAuthenticationChangedNotification;
use App\Services\TwoFactorAuthenticationService;
use App\Support\RequestOrigin;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class TwoFactorAuthenticationController extends Controller
{
    /**
     * Generates a fresh secret and stores it unconfirmed — nothing checks
     * logins against it until confirm() below verifies a real code from the
     * app it was just scanned into. Calling this again before confirming
     * (e.g. the user backs out and restarts setup) simply replaces the
     * pending secret; there is nothing yet to invalidate.
     */
    public function store(EnableTwoFactorAuthenticationRequest $request, TwoFactorAuthenticationService $service): JsonResponse
    {
        $user = $request->user();
        $secret = $service->generateSecretKey();

        $user->forceFill([
            'two_factor_secret' => $secret,
            'two_factor_recovery_codes' => null,
            'two_factor_confirmed_at' => null,
        ])->save();

        return response()->json(['data' => [
            'secret' => $secret,
            'otpauth_url' => $service->qrCodeUrl($user, $secret),
        ]]);
    }

    public function confirm(ConfirmTwoFactorAuthenticationRequest $request, TwoFactorAuthenticationService $service): JsonResponse
    {
        $user = $request->user();

        if (! $user->two_factor_secret) {
            throw ValidationException::withMessages([
                'code' => __('Start setup before confirming a code.'),
            ]);
        }

        if (! $service->verify($user->two_factor_secret, $request->validated('code'))) {
            throw ValidationException::withMessages([
                'code' => __('The provided code was invalid.'),
            ]);
        }

        $recoveryCodes = $service->generateRecoveryCodes();

        $user->forceFill([
            'two_factor_recovery_codes' => $recoveryCodes,
            'two_factor_confirmed_at' => now(),
        ])->save();

        [$ip, $country] = RequestOrigin::of($request);
        $user->notify(new TwoFactorAuthenticationChangedNotification(enabled: true, ip: $ip, country: $country));

        // A flat array, consistent with recoveryCodes()/regenerateRecoveryCodes()
        // below — not wrapped in a 'recovery_codes' key, which the frontend
        // doesn't expect here any more than it does from those two.
        return response()->json(['data' => $recoveryCodes]);
    }

    public function destroy(DisableTwoFactorAuthenticationRequest $request): JsonResponse
    {
        $user = $request->user();
        $wasEnabled = $user->hasEnabledTwoFactorAuthentication();

        $user->forceFill([
            'two_factor_secret' => null,
            'two_factor_recovery_codes' => null,
            'two_factor_confirmed_at' => null,
        ])->save();

        // Only alert when 2FA was actually on -- a no-op "disable" on an
        // account that never enabled it isn't a security event.
        if ($wasEnabled) {
            [$ip, $country] = RequestOrigin::of($request);
            $user->notify(new TwoFactorAuthenticationChangedNotification(enabled: false, ip: $ip, country: $country));
        }

        return response()->json(['message' => __('Two-factor authentication disabled.')]);
    }

    public function recoveryCodes(Request $request): JsonResponse
    {
        return response()->json(['data' => $request->user()->two_factor_recovery_codes ?? []]);
    }

    public function regenerateRecoveryCodes(Request $request, TwoFactorAuthenticationService $service): JsonResponse
    {
        abort_unless($request->user()->hasEnabledTwoFactorAuthentication(), 422);

        $recoveryCodes = $service->generateRecoveryCodes();
        $request->user()->forceFill(['two_factor_recovery_codes' => $recoveryCodes])->save();

        return response()->json(['data' => $recoveryCodes]);
    }
}
