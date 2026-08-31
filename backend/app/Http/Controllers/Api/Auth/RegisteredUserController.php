<?php

namespace App\Http\Controllers\Api\Auth;

use App\Enums\Locale;
use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\RegisterRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use Illuminate\Auth\Events\Registered;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;

class RegisteredUserController extends Controller
{
    public function store(RegisterRequest $request): JsonResponse
    {
        // role/locale set explicitly rather than relying on their DB-level
        // defaults: Eloquent doesn't sync those back into the in-memory
        // model after create(), so the immediate response would otherwise
        // report both as null. locale specifically inherits whatever
        // SetLocaleFromUser (global middleware, already run by this point)
        // resolved from this guest request's Accept-Language header — a
        // French-speaking visitor who just registered shouldn't have to
        // manually switch away from English right after signing up.
        $user = User::create([
            'name' => $request->validated('name'),
            'email' => $request->validated('email'),
            'password' => Hash::make($request->validated('password')),
            'role' => UserRole::User,
            'locale' => Locale::from(app()->getLocale()),
        ]);

        event(new Registered($user));

        Auth::guard('web')->login($user);

        $request->session()->regenerate();

        return (new UserResource($user))->response()->setStatusCode(201);
    }
}
