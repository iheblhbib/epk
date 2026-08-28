<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreArtistRequest;
use App\Http\Requests\UpdateArtistRequest;
use App\Http\Resources\ArtistResource;
use App\Models\Artist;
use App\Models\Workspace;
use Illuminate\Http\JsonResponse;
use Illuminate\Validation\ValidationException;

class ArtistController extends Controller
{
    public function index(Workspace $workspace): JsonResponse
    {
        $this->authorize('viewAny', [Artist::class, $workspace]);

        return ArtistResource::collection($workspace->artists()->orderBy('name')->get())->response();
    }

    public function store(StoreArtistRequest $request, Workspace $workspace): JsonResponse
    {
        $artist = $workspace->artists()->create($request->validated());

        return (new ArtistResource($artist))->response()->setStatusCode(201);
    }

    public function show(Artist $artist): JsonResponse
    {
        $this->authorize('view', $artist);

        return (new ArtistResource($artist))->response();
    }

    public function update(UpdateArtistRequest $request, Artist $artist): JsonResponse
    {
        $artist->update($request->validated());

        return (new ArtistResource($artist))->response();
    }

    public function destroy(Artist $artist): JsonResponse
    {
        $this->authorize('delete', $artist);

        if ($artist->epks()->exists()) {
            throw ValidationException::withMessages([
                'artist' => __('This artist still has EPKs. Delete or reassign them first.'),
            ]);
        }

        $artist->delete();

        return response()->json(['message' => __('Artist deleted.')]);
    }
}
