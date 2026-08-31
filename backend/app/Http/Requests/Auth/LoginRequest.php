<?php

namespace App\Http\Requests\Auth;

use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;

class LoginRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'email' => ['required', 'string', 'email'],
            'password' => ['required', 'string'],
            'remember' => ['sometimes', 'boolean'],
        ];
    }

    /**
     * Attempt to authenticate the request's credentials, returning the
     * user. This only verifies the password — AuthenticatedSessionController
     * decides afterward whether that's enough to finish logging in, or
     * whether a confirmed two-factor secret means undoing this provisional
     * session login and routing through TwoFactorChallengeController first.
     *
     * Throttling for repeated failed attempts is handled by the "login"
     * rate limiter (see AppServiceProvider) applied to the route.
     *
     * @throws ValidationException
     */
    public function authenticate(): User
    {
        if (! Auth::guard('web')->attempt($this->only('email', 'password'), $this->boolean('remember'))) {
            throw ValidationException::withMessages([
                'email' => __('auth.failed'),
            ]);
        }

        $user = Auth::guard('web')->user();

        if ($user->suspended_at !== null) {
            Auth::guard('web')->logout();

            throw ValidationException::withMessages([
                'email' => __('This account has been suspended. Contact support for help.'),
            ]);
        }

        return $user;
    }
}
