<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Artist;
use App\Models\Contact;
use App\Models\Epk;
use App\Models\Media;
use App\Models\Workspace;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * A single query fanned out across the four things a workspace member is
 * likely typing a few letters of: EPKs, artists, contacts, media. Each
 * category is capped at a handful of rows — this is a jump-to lookup for a
 * command-palette-style search box, not a paginated results page, so more
 * than a handful would just be noise to scroll past.
 */
class GlobalSearchController extends Controller
{
    private const PER_CATEGORY_LIMIT = 5;

    public function index(Request $request, Workspace $workspace): JsonResponse
    {
        $this->authorize('view', $workspace);

        $query = trim((string) $request->query('q', ''));

        if (mb_strlen($query) < 2) {
            return response()->json(['data' => ['epks' => [], 'artists' => [], 'contacts' => [], 'media' => []]]);
        }

        $like = '%'.$query.'%';

        $epks = Epk::where('workspace_id', $workspace->id)
            ->where('title', 'like', $like)
            ->latest()
            ->limit(self::PER_CATEGORY_LIMIT)
            ->get(['id', 'title', 'slug', 'status'])
            ->map(fn (Epk $epk) => [
                'id' => $epk->id,
                'title' => $epk->title,
                'slug' => $epk->slug,
                'status' => $epk->status,
            ]);

        $artists = Artist::where('workspace_id', $workspace->id)
            ->where('name', 'like', $like)
            ->limit(self::PER_CATEGORY_LIMIT)
            ->get(['id', 'name'])
            ->map(fn (Artist $artist) => ['id' => $artist->id, 'name' => $artist->name]);

        $contacts = Contact::where('workspace_id', $workspace->id)
            ->where(function ($contactQuery) use ($like) {
                $contactQuery->where('name', 'like', $like)
                    ->orWhere('email', 'like', $like)
                    ->orWhere('organization', 'like', $like);
            })
            ->limit(self::PER_CATEGORY_LIMIT)
            ->get(['id', 'name', 'email'])
            ->map(fn (Contact $contact) => ['id' => $contact->id, 'name' => $contact->name, 'email' => $contact->email]);

        $media = Media::where('workspace_id', $workspace->id)
            ->where('original_filename', 'like', $like)
            ->limit(self::PER_CATEGORY_LIMIT)
            ->get()
            ->map(fn (Media $item) => [
                'id' => $item->id,
                'filename' => $item->original_filename,
                'type' => $item->type,
                'thumbnail_url' => $item->thumbnailUrl() ?? $item->url(),
            ]);

        return response()->json(['data' => [
            'epks' => $epks,
            'artists' => $artists,
            'contacts' => $contacts,
            'media' => $media,
        ]]);
    }
}
