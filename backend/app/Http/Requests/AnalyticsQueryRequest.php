<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class AnalyticsQueryRequest extends FormRequest
{
    public function authorize(): bool
    {
        // Bound to whichever route this request is used on -- the per-EPK
        // analytics route (`epk` param) or the workspace-wide one
        // (`workspace` param). Exactly one of these is present depending on
        // which route matched.
        $subject = $this->route('epk') ?? $this->route('workspace');

        return $subject !== null && $this->user()->can('view', $subject);
    }

    public function rules(): array
    {
        return [
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
        ];
    }
}
