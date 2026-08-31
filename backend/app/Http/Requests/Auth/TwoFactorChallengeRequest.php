<?php

namespace App\Http\Requests\Auth;

use Illuminate\Foundation\Http\FormRequest;

// Deliberately unauthenticated (see routes/api.php) — this is *how* someone
// finishes logging in, so there's no user session yet to authorize against.
// The only thing standing in for that is the pending user id AuthenticatedSessionController
// stashed in the session during the credentials step.
class TwoFactorChallengeRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'code' => ['required_without:recovery_code', 'nullable', 'string'],
            'recovery_code' => ['required_without:code', 'nullable', 'string'],
        ];
    }
}
