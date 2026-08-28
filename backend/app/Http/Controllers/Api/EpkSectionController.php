<?php

namespace App\Http\Controllers\Api;

use App\Enums\SectionType;
use App\Http\Controllers\Controller;
use App\Http\Requests\ReorderEpkSectionsRequest;
use App\Http\Requests\StoreEpkSectionRequest;
use App\Http\Requests\UpdateEpkSectionRequest;
use App\Http\Resources\EpkSectionResource;
use App\Models\Epk;
use App\Models\EpkSection;
use App\Services\RichTextSanitizer;
use Illuminate\Http\JsonResponse;
use Illuminate\Validation\ValidationException;

class EpkSectionController extends Controller
{
    public function __construct(private readonly RichTextSanitizer $sanitizer) {}

    public function index(Epk $epk): JsonResponse
    {
        $this->authorize('view', $epk);

        return EpkSectionResource::collection($epk->sections)->response();
    }

    public function store(StoreEpkSectionRequest $request, Epk $epk): JsonResponse
    {
        $type = SectionType::from($request->validated('type'));

        if ($type->isSingleton() && $epk->sections()->where('type', $type)->exists()) {
            throw ValidationException::withMessages([
                'type' => __('An EPK can only have one :section section.', ['section' => $type->label()]),
            ]);
        }

        $nextPosition = (int) $epk->sections()->max('position') + 1;

        // is_enabled set explicitly rather than relying on the column's DB-level
        // default: Eloquent doesn't sync that back into the in-memory model
        // after create(), so the immediate response would show null instead.
        $section = $epk->sections()->create([
            'type' => $type,
            'title' => $request->validated('title'),
            'is_enabled' => true,
            'position' => $nextPosition,
            'config' => $type->defaultConfig(),
        ]);

        return (new EpkSectionResource($section))->response()->setStatusCode(201);
    }

    public function update(UpdateEpkSectionRequest $request, Epk $epk, EpkSection $section): JsonResponse
    {
        $this->assertBelongsToEpk($epk, $section);

        $data = $request->validated();

        if (isset($data['config']) && in_array($section->type, [SectionType::Biography, SectionType::Custom], true)) {
            if (array_key_exists('html', $data['config'])) {
                $data['config']['html'] = $this->sanitizer->clean((string) $data['config']['html']);
            }
        }

        $section->update($data);

        return (new EpkSectionResource($section))->response();
    }

    public function destroy(Epk $epk, EpkSection $section): JsonResponse
    {
        $this->authorize('update', $epk);
        $this->assertBelongsToEpk($epk, $section);

        $section->delete();

        return response()->json(['message' => __('Section removed.')]);
    }

    public function duplicate(Epk $epk, EpkSection $section): JsonResponse
    {
        $this->authorize('update', $epk);
        $this->assertBelongsToEpk($epk, $section);

        if ($section->type->isSingleton()) {
            throw ValidationException::withMessages([
                'type' => __('An EPK can only have one :section section.', ['section' => $section->type->label()]),
            ]);
        }

        $nextPosition = (int) $epk->sections()->max('position') + 1;

        $copy = $section->replicate();
        $copy->position = $nextPosition;
        $copy->save();

        return (new EpkSectionResource($copy))->response()->setStatusCode(201);
    }

    public function reorder(ReorderEpkSectionsRequest $request, Epk $epk): JsonResponse
    {
        foreach ($request->validated('section_ids') as $position => $id) {
            EpkSection::where('id', $id)->where('epk_id', $epk->id)->update(['position' => $position]);
        }

        return EpkSectionResource::collection($epk->sections()->get())->response();
    }

    private function assertBelongsToEpk(Epk $epk, EpkSection $section): void
    {
        abort_unless($section->epk_id === $epk->id, 404);
    }
}
