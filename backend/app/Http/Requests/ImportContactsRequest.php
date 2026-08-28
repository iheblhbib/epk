<?php

namespace App\Http\Requests;

use App\Models\Contact;
use Illuminate\Foundation\Http\FormRequest;

class ImportContactsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('import', [Contact::class, $this->route('workspace')]);
    }

    public function rules(): array
    {
        return [
            // mimes:csv,txt — a CSV exported from Excel/Sheets is
            // frequently reported as text/plain rather than text/csv by
            // the browser, so txt is accepted too; content is still just
            // parsed as CSV regardless of what the extension claims.
            'file' => ['required', 'file', 'mimes:csv,txt', 'max:2048'],
        ];
    }
}
