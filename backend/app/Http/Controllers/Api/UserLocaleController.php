<?php

namespace App\Http\Controllers\Api;

use App\Enums\Locale;
use App\Http\Controllers\Controller;
use App\Http\Resources\UserResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class UserLocaleController extends Controller
{
    // A UI preference, not profile info — kept separate from
    // UserProfileController/UpdateProfileRequest so switching languages
    // never touches (or re-triggers verification on) name/email.
    public function update(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'locale' => ['required', Rule::enum(Locale::class)],
        ]);

        $request->user()->update(['locale' => $validated['locale']]);

        return (new UserResource($request->user()))->response();
    }
}
