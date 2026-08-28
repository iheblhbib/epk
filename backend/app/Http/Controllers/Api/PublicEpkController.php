<?php

namespace App\Http\Controllers\Api;

use App\Enums\SectionType;
use App\Http\Controllers\Controller;
use App\Http\Resources\PublicEpkResource;
use App\Models\Epk;
use App\Models\Media;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class PublicEpkController extends Controller
{
    /**
     * Unauthenticated lookup by slug. Scoping to `published` here — rather
     * than loading first and checking status — means a draft/archived EPK
     * 404s exactly like a slug that doesn't exist at all, so this endpoint
     * never confirms the existence of a press kit its owner hasn't published.
     */
    public function show(string $slug): JsonResponse
    {
        $epk = Epk::query()
            ->published()
            ->where('slug', $slug)
            ->with([
                'artist',
                'sections' => fn ($query) => $query->where('is_enabled', true)->orderBy('position'),
            ])
            ->firstOrFail();

        // So PublicSectionConfigResolver can build a slug-scoped download URL
        // for Downloads-section files without an extra query per section —
        // $epk is already loaded, this just attaches it in memory.
        $epk->sections->each(fn ($section) => $section->setRelation('epk', $epk));

        return (new PublicEpkResource($epk))->response();
    }

    /**
     * Streams a file with `Content-Disposition: attachment` so it actually
     * downloads instead of opening inline in a new tab (the browser's
     * default for PDFs/images/etc. served as a plain URL). Scoped tightly:
     * the media must actually be attached to an *enabled* Downloads section
     * on this *published* EPK — not just "any media in the workspace" —
     * otherwise this would double as an open file-download oracle for any
     * media row in the app.
     */
    public function downloadFile(string $slug, Media $media): StreamedResponse
    {
        $epk = Epk::query()
            ->published()
            ->where('slug', $slug)
            ->with(['sections' => fn ($query) => $query->where('type', SectionType::Downloads->value)->where('is_enabled', true)])
            ->firstOrFail();

        $allowedMediaIds = $epk->sections
            ->flatMap(fn ($section) => $section->config['media_ids'] ?? [])
            ->map(fn ($id) => (int) $id);

        abort_unless($allowedMediaIds->contains($media->id), 404);

        return Storage::disk($media->disk)->download($media->path, $media->original_filename);
    }
}
