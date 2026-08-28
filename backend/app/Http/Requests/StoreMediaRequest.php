<?php

namespace App\Http\Requests;

use App\Enums\MediaType;
use App\Models\Media;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\UploadedFile;

class StoreMediaRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('create', [Media::class, $this->route('workspace')]);
    }

    public function rules(): array
    {
        return [
            'files' => ['required', 'array', 'min:1', 'max:20'],
            'files.*' => [
                'required',
                'file',
                'mimes:'.implode(',', config('media.allowed_extensions')),
            ],
        ];
    }

    /**
     * The "mimes" rule already whitelists allowed extensions, but the max
     * file size depends on which type that extension maps to (a 200MB video
     * limit would be meaningless as a blanket rule for images) — checked
     * here once the extension (and therefore type) is known.
     */
    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator) {
            foreach ($this->file('files', []) as $index => $file) {
                if (! $file instanceof UploadedFile || ! $file->isValid()) {
                    continue;
                }

                try {
                    $type = MediaType::fromExtension($file->getClientOriginalExtension());
                } catch (\InvalidArgumentException) {
                    continue;
                }

                $maxKb = (int) config("media.max_size_kb.{$type->value}");

                if ($file->getSize() > $maxKb * 1024) {
                    $validator->errors()->add(
                        "files.{$index}",
                        __('This :type file exceeds the :max limit.', [
                            'type' => $type->value,
                            'max' => number_format($maxKb / 1024, 0).'MB',
                        ])
                    );
                }
            }
        });
    }
}
