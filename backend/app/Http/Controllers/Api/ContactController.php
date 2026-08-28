<?php

namespace App\Http\Controllers\Api;

use App\Enums\ContactCategory;
use App\Http\Controllers\Controller;
use App\Http\Requests\ImportContactsRequest;
use App\Http\Requests\StoreContactRequest;
use App\Http\Requests\UpdateContactRequest;
use App\Http\Resources\ContactResource;
use App\Models\Contact;
use App\Models\Workspace;
use App\Services\ContactCsvImporter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ContactController extends Controller
{
    private const EXPORT_COLUMNS = ['name', 'email', 'phone', 'category', 'organization', 'notes'];

    public function index(Request $request, Workspace $workspace): JsonResponse
    {
        $this->authorize('viewAny', [Contact::class, $workspace]);

        Validator::make($request->query(), [
            'search' => ['nullable', 'string', 'max:255'],
            'category' => ['nullable', Rule::enum(ContactCategory::class)],
        ])->validate();

        $contacts = $workspace->contacts()
            ->when($request->query('search'), function ($query, $search) {
                $query->where(function ($query) use ($search) {
                    $query->where('name', 'like', "%{$search}%")
                        ->orWhere('email', 'like', "%{$search}%")
                        ->orWhere('organization', 'like', "%{$search}%");
                });
            })
            ->when($request->query('category'), fn ($query, $category) => $query->where('category', $category))
            ->orderBy('name')
            ->get();

        return ContactResource::collection($contacts)->response();
    }

    public function store(StoreContactRequest $request, Workspace $workspace): JsonResponse
    {
        $contact = $workspace->contacts()->create([
            // Explicit rather than relying on the column's DB-level default
            // when 'category' is omitted — Eloquent doesn't sync that back
            // into the in-memory model after create(), so the immediate
            // response's category would be null instead of 'other'.
            'category' => ContactCategory::Other,
            ...$request->validated(),
            'created_by' => $request->user()->id,
        ]);

        return (new ContactResource($contact))->response()->setStatusCode(201);
    }

    public function show(Contact $contact): JsonResponse
    {
        $this->authorize('view', $contact);

        return (new ContactResource($contact))->response();
    }

    public function update(UpdateContactRequest $request, Contact $contact): JsonResponse
    {
        $contact->update($request->validated());

        return (new ContactResource($contact))->response();
    }

    public function destroy(Contact $contact): JsonResponse
    {
        $this->authorize('delete', $contact);

        $contact->delete();

        return response()->json(['message' => __('Contact deleted.')]);
    }

    public function export(Workspace $workspace): StreamedResponse
    {
        $this->authorize('viewAny', [Contact::class, $workspace]);

        $filename = 'contacts-'.$workspace->slug.'.csv';

        return response()->streamDownload(function () use ($workspace) {
            $handle = fopen('php://output', 'w');
            fputcsv($handle, self::EXPORT_COLUMNS);

            $workspace->contacts()->orderBy('name')->chunk(200, function ($contacts) use ($handle) {
                foreach ($contacts as $contact) {
                    fputcsv($handle, array_map(self::escapeCsvFormula(...), [
                        $contact->name,
                        $contact->email,
                        $contact->phone,
                        $contact->category->value,
                        $contact->organization,
                        $contact->notes,
                    ]));
                }
            });

            fclose($handle);
        }, $filename, ['Content-Type' => 'text/csv']);
    }

    /**
     * CSV/formula injection guard: a cell that opens with =, +, -, @, tab, or
     * CR is a live formula the moment Excel/Sheets opens this export — one
     * of these fields (name, organization, notes) round-tripped straight
     * from another user's free-text input (typed directly, or via CSV
     * import). Prefixing with a literal quote makes every spreadsheet app
     * treat it as text instead of evaluating it.
     */
    private static function escapeCsvFormula(?string $value): ?string
    {
        if ($value !== null && preg_match('/^[=+\-@\t\r]/', $value) === 1) {
            return "'".$value;
        }

        return $value;
    }

    public function import(ImportContactsRequest $request, Workspace $workspace, ContactCsvImporter $importer): JsonResponse
    {
        $summary = $importer->import($workspace, $request->file('file')->getRealPath(), $request->user()->id);

        return response()->json(['data' => $summary]);
    }
}
