<?php

namespace App\Http\Requests;

use App\Enums\SectionType;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreEpkSectionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('update', $this->route('epk'));
    }

    public function rules(): array
    {
        return [
            'type' => ['required', Rule::enum(SectionType::class)],
            'title' => ['nullable', 'string', 'max:255'],
        ];
    }
}
