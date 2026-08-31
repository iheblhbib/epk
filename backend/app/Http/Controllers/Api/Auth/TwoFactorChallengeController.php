<?php

namespace App\Http\Controllers\Api\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\TwoFactorChallengeRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use App\Services\TwoFactorAuthenticationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;

class TwoFactorChallengeController extends Controller
{
    /**
     * The second step of a two-factor login — completes what
     * AuthenticatedSessionController::store() left pending. There's no
     * authenticated user yet at this point, only whatever it stashed in
     * the session after the password check passed.
     */
    public function store(TwoFactorChallengeRequest $request, TwoFactorAuthenticationService $service): JsonResponse
    {
        $userId = $request->session()->get('two_factor.user_id');

        if (! $userId) {
            throw ValidationException::withMessages([
                'code' => __('Your session has expired. Please log in again.'),
            ]);
        }

        $user = User::findOrFail($userId);

        $valid = $request->filled('recovery_code')
            ? $service->useRecoveryCode($user, $request->string('recovery_code')->value())
            : $service->verify($user->two_factor_secret, $request->string('code')->value());

        if (! $valid) {
            throw ValidationException::withMessages([
                'code' => __('The provided code was invalid.'),
            ]);
        }

        $remember = $request->session()->pull('two_factor.remember', false);
        $request->session()->forget('two_factor.user_id');

        Auth::guard('web')->login($user, $remember);
        $request->session()->regenerate();

        return (new UserResource($user))->response();
    }
}
