<?php

namespace App\Http\Requests;

use App\Models\Epk;
use App\Models\Workspace;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreEpkRequest extends FormRequest
{
    public function authorize(): bool
    {
        $workspace = Workspace::find($this->input('workspace_id'));

        return $workspace !== null && $this->user()->can('create', [Epk::class, $workspace]);
    }

    public function rules(): array
    {
        return [
            'workspace_id' => ['required', 'integer', 'exists:workspaces,id'],
            'artist_id' => [
                'required',
                'integer',
                Rule::exists('artists', 'id')->where('workspace_id', $this->input('workspace_id')),
            ],
            'title' => ['required', 'string', 'max:255'],
            'seo_title' => ['nullable', 'string', 'max:255'],
            'seo_description' => ['nullable', 'string', 'max:500'],
        ];
    }

    public function messages(): array
    {
        return [
            'artist_id.exists' => 'The selected artist does not belong to this workspace.',
        ];
    }
}
