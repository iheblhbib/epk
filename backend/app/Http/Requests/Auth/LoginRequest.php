<?php

namespace App\Http\Requests\Auth;

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
     * Attempt to authenticate the request's credentials.
     *
     * Throttling for repeated failed attempts is handled by the "login"
     * rate limiter (see AppServiceProvider) applied to the route.
     *
     * @throws ValidationException
     */
    public function authenticate(): void
    {
        if (! Auth::guard('web')->attempt($this->only('email', 'password'), $this->boolean('remember'))) {
            throw ValidationException::withMessages([
                'email' => __('auth.failed'),
            ]);
        }

        if (Auth::guard('web')->user()->suspended_at !== null) {
            Auth::guard('web')->logout();

            throw ValidationException::withMessages([
                'email' => __('This account has been suspended. Contact support for help.'),
            ]);
        }
    }
}
