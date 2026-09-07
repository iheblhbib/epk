<?php

namespace App\Http\Controllers\Api\Auth;

use App\Enums\Locale;
use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\RegisterRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use App\Services\WorkspaceCreator;
use Illuminate\Auth\Events\Registered;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Throwable;

class RegisteredUserController extends Controller
{
    public function store(RegisterRequest $request, WorkspaceCreator $workspaceCreator): JsonResponse
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

        // Same Accept-Language resolution as the locale set above -- a new
        // user lands straight in a workspace named in their own language
        // instead of a blank "create your first workspace" prompt. Unlike
        // the verification email below, a failure here isn't swallowed:
        // this app assumes every user has at least one workspace almost
        // everywhere, so an account with none is a broken state worth a
        // failed registration over, not a silent gap to paper over later.
        $workspaceCreator->createWithOwner(__('My First Workspace'), $user);

        // Sending the verification email happens synchronously (see
        // WorkspaceInvitationNotification's docblock -- no queue worker is
        // assumed to be running), so a mail-server outage would otherwise
        // bubble an uncaught transport exception all the way up and 500 the
        // whole registration -- even though the account itself was already
        // created successfully above. The user can always hit "resend"
        // once mail is working again; they shouldn't be locked out of an
        // account that demonstrably exists because of an unrelated SMTP
        // hiccup.
        try {
            event(new Registered($user));
        } catch (Throwable $e) {
            Log::error('Failed to send the verification email during registration.', [
                'user_id' => $user->id,
                'exception' => $e,
            ]);
        }

        Auth::guard('web')->login($user);

        $request->session()->regenerate();

        return (new UserResource($user))->response()->setStatusCode(201);
    }
}
