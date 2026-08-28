<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ReorderEpkSectionsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('update', $this->route('epk'));
    }

    public function rules(): array
    {
        $epk = $this->route('epk');

        return [
            'section_ids' => ['required', 'array'],
            'section_ids.*' => [
                'required',
                'integer',
                Rule::exists('epk_sections', 'id')->where('epk_id', $epk->id),
            ],
        ];
    }
}
