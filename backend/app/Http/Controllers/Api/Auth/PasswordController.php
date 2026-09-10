<?php

namespace App\Http\Controllers\Api\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\UpdatePasswordRequest;
use App\Notifications\PasswordChangedNotification;
use App\Support\RequestOrigin;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Hash;

class PasswordController extends Controller
{
    public function update(UpdatePasswordRequest $request): JsonResponse
    {
        $user = $request->user();

        $user->update([
            'password' => Hash::make($request->validated('password')),
        ]);

        [$ip, $country] = RequestOrigin::of($request);
        $user->notify(new PasswordChangedNotification($ip, $country));

        return response()->json(['message' => __('Password updated.')]);
    }
}
