<?php

namespace App\Http\Controllers\Api\Auth;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Throwable;

class EmailVerificationNotificationController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        if ($request->user()->hasVerifiedEmail()) {
            return response()->json(['message' => __('Email already verified.')]);
        }

        // Same reasoning as RegisteredUserController::store() -- a mail-server
        // outage shouldn't 500 the resend button. The user already knows
        // nothing arrived (that's why they clicked resend); a friendly
        // "try again" response here is honest and doesn't crash the request.
        try {
            $request->user()->sendEmailVerificationNotification();
        } catch (Throwable $e) {
            Log::error('Failed to resend the verification email.', [
                'user_id' => $request->user()->id,
                'exception' => $e,
            ]);

            return response()->json(['message' => __('We could not send the verification email right now — please try again in a moment.')], 503);
        }

        return response()->json(['message' => __('Verification link sent.')]);
    }
}
