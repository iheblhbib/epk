<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreEpkCustomDomainRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('update', $this->route('epk'));
    }

    public function rules(): array
    {
        return [
            'domain' => [
                'required',
                'string',
                'max:255',
                // A real, multi-label hostname (e.g. "press.example.com") —
                // no scheme, no path, no bare single-label name.
                'regex:/^(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/i',
                Rule::unique('epks', 'custom_domain')->ignore($this->route('epk')),
            ],
        ];
    }

    public function messages(): array
    {
        return [
            'domain.regex' => __('Enter a real domain, like press.yourband.com.'),
            'domain.unique' => __('This domain is already in use by another EPK.'),
        ];
    }
}
