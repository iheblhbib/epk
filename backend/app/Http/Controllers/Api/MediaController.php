<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreMediaRequest;
use App\Http\Requests\UpdateMediaRequest;
use App\Http\Resources\MediaResource;
use App\Models\Media;
use App\Models\Workspace;
use App\Services\MediaUploadService;
use App\Services\PlanLimits;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\StreamedResponse;

class MediaController extends Controller
{
    public function __construct(private readonly MediaUploadService $uploads) {}

    public function index(Request $request, Workspace $workspace): JsonResponse
    {
        $this->authorize('viewAny', [Media::class, $workspace]);

        $query = $workspace->media()->with('uploader');

        if ($search = $request->query('search')) {
            $query->where('original_filename', 'like', '%'.$search.'%');
        }

        if ($type = $request->query('type')) {
            $query->where('type', $type);
        }

        $query->orderBy(
            match ($request->query('sort_by', 'created_at')) {
                'name' => 'original_filename',
                'size' => 'size',
                default => 'created_at',
            },
            $request->query('sort_dir', 'desc') === 'asc' ? 'asc' : 'desc'
        );

        return MediaResource::collection($query->get())->response();
    }

    public function store(StoreMediaRequest $request, Workspace $workspace, PlanLimits $planLimits): JsonResponse
    {
        $incomingBytes = collect($request->file('files'))->sum(fn ($file) => $file->getSize());

        if (! $planLimits->hasStorageFor($workspace, $incomingBytes)) {
            throw ValidationException::withMessages([
                'files' => __('This upload would exceed your plan\'s storage limit. Upgrade or free up space.'),
            ]);
        }

        $media = collect($request->file('files'))
            ->map(fn ($file) => $this->uploads->store($file, $workspace, $request->user()->id));

        return MediaResource::collection($media)->response()->setStatusCode(201);
    }

    public function update(UpdateMediaRequest $request, Media $media): JsonResponse
    {
        // Renaming only ever changes the base name. The extension always
        // comes from the file's real, securely stored name — never trust the
        // client to preserve (or not remove) it, since a mismatched or
        // missing extension breaks opening the downloaded file.
        $baseName = pathinfo($request->validated('original_filename'), PATHINFO_FILENAME);
        $baseName = trim($baseName) !== '' ? trim($baseName) : pathinfo($media->original_filename, PATHINFO_FILENAME);

        $media->update(['original_filename' => "{$baseName}.{$media->extension()}"]);

        return (new MediaResource($media))->response();
    }

    public function destroy(Media $media): JsonResponse
    {
        $this->authorize('delete', $media);

        $this->uploads->delete($media);
        $media->delete();

        return response()->json(['message' => __('File deleted.')]);
    }

    public function download(Media $media): StreamedResponse
    {
        $this->authorize('view', $media);

        return Storage::disk($media->disk)->download($media->path, $media->original_filename);
    }
}
