<?php

namespace App\Http\Requests;

use App\Enums\AnalyticsEventType;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreAnalyticsEventRequest extends FormRequest
{
    public function authorize(): bool
    {
        // Public endpoint — any visitor on a published EPK's page may report
        // their own interaction with it.
        return true;
    }

    public function rules(): array
    {
        return [
            'type' => ['required', Rule::enum(AnalyticsEventType::class)],
            'meta' => ['nullable', 'array'],
            'meta.filename' => ['nullable', 'string', 'max:255'],
        ];
    }
}
