<?php

namespace App\Http\Requests;

use App\Enums\EpkTheme;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateEpkRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('update', $this->route('epk'));
    }

    public function rules(): array
    {
        $epk = $this->route('epk');

        return [
            'artist_id' => [
                'sometimes', 'required', 'integer',
                Rule::exists('artists', 'id')->where('workspace_id', $epk->workspace_id),
            ],
            'title' => ['sometimes', 'required', 'string', 'max:255'],
            'theme' => ['sometimes', 'required', Rule::enum(EpkTheme::class)],
            // Every axis is optional and independently validated — a null/
            // absent value means "inherit from the preset", resolved entirely
            // on the frontend. Unlisted keys are silently dropped since only
            // validated keys survive into $request->validated().
            'custom_settings' => ['nullable', 'array'],
            'custom_settings.background_color' => ['nullable', 'string', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'custom_settings.text_color' => ['nullable', 'string', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'custom_settings.accent_color' => ['nullable', 'string', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'custom_settings.font' => ['nullable', Rule::in(['sans', 'serif', 'display', 'mono'])],
            'custom_settings.button_style' => ['nullable', Rule::in(['rounded', 'pill', 'square'])],
            'custom_settings.radius' => ['nullable', Rule::in(['none', 'small', 'medium', 'large'])],
            'custom_settings.spacing' => ['nullable', Rule::in(['compact', 'comfortable', 'spacious'])],
            'custom_settings.header_style' => ['nullable', Rule::in(['centered', 'left', 'minimal'])],
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
