<?php

namespace App\Http\Controllers\Api\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Resources\UserResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class AuthenticatedSessionController extends Controller
{
    public function store(LoginRequest $request): JsonResponse
    {
        $user = $request->authenticate();

        if ($user->hasEnabledTwoFactorAuthentication()) {
            // The attempt() above already started a session-backed login —
            // undo it. Real authentication isn't complete until
            // TwoFactorChallengeController verifies a code, so nothing
            // should be usable as this user in the meantime.
            Auth::guard('web')->logout();

            $request->session()->put('two_factor.user_id', $user->id);
            $request->session()->put('two_factor.remember', $request->boolean('remember'));

            return response()->json(['data' => ['two_factor_required' => true]]);
        }

        $request->session()->regenerate();

        return (new UserResource($user))->response();
    }

    public function destroy(Request $request): JsonResponse
    {
        Auth::guard('web')->logout();

        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->json(['message' => __('You have been logged out.')]);
    }
}
