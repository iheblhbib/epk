<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreEpkSectionCommentRequest extends FormRequest
{
    // Anyone who can see the EPK can leave a comment on it — including a
    // viewer-role teammate giving feedback, not just editors who can
    // actually change the section itself.
    public function authorize(): bool
    {
        return $this->user()->can('view', $this->route('epk'));
    }

    public function rules(): array
    {
        return [
            'body' => ['required', 'string', 'max:2000'],
        ];
    }
}
