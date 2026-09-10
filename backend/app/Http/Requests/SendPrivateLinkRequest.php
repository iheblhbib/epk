<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class SendPrivateLinkRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('update', $this->route('epk'));
    }

    public function rules(): array
    {
        return [
            'recipient_email' => ['required', 'email', 'max:255'],
            'recipient_name' => ['nullable', 'string', 'max:255'],
            'message' => ['nullable', 'string', 'max:1000'],
            'include_password' => ['sometimes', 'boolean'],
            // Only consulted when include_password is true and the link
            // actually has a password — the controller checks it against the
            // link so a typo'd password never reaches the recipient.
            'password' => ['required_if:include_password,true', 'nullable', 'string'],
        ];
    }
}
