<?php

namespace App\Http\Requests;

use App\Models\Artist;
use Illuminate\Foundation\Http\FormRequest;

class StoreArtistRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('create', [Artist::class, $this->route('workspace')]);
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'stage_name' => ['nullable', 'string', 'max:255'],
            'short_bio' => ['nullable', 'string', 'max:1000'],
            'country' => ['nullable', 'string', 'max:255'],
            'city' => ['nullable', 'string', 'max:255'],
            'genre' => ['nullable', 'string', 'max:255'],
            'website' => ['nullable', 'url', 'max:255'],
            'booking_email' => ['nullable', 'email', 'max:255'],
            'press_email' => ['nullable', 'email', 'max:255'],
            'management_email' => ['nullable', 'email', 'max:255'],
        ];
    }
}
