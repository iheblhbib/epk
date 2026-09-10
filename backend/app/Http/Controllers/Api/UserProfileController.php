<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\UpdateProfileRequest;
use App\Http\Resources\UserResource;
use App\Notifications\EmailChangeNotification;
use App\Support\RequestOrigin;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Notification;

class UserProfileController extends Controller
{
    public function update(UpdateProfileRequest $request): JsonResponse
    {
        $user = $request->user();

        $previousEmail = $user->email;
        $emailChanged = $request->validated('email') !== $previousEmail;

        $user->fill($request->validated());

        if ($emailChanged) {
            $user->email_verified_at = null;
        }

        $user->save();

        if ($emailChanged) {
            $user->sendEmailVerificationNotification();

            // Alert the address that just lost access -- routed on-demand
            // since it's no longer attached to any User row.
            [$ip, $country] = RequestOrigin::of($request);
            Notification::route('mail', $previousEmail)
                ->notify(new EmailChangeNotification($user->email, $ip, $country));
        }

        return (new UserResource($user))->response();
    }
}
