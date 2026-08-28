<?php

namespace App\Http\Controllers\Api\Admin;

use App\Enums\EpkStatus;
use App\Http\Controllers\Controller;
use App\Models\Epk;
use App\Services\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdminEpkController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $epks = Epk::query()
            ->with(['workspace:id,name', 'artist:id,name'])
            ->when($request->filled('status'), fn ($query) => $query->where('status', $request->string('status')))
            ->when($request->string('search')->trim()->isNotEmpty(), function ($query) use ($request) {
                $query->where('title', 'like', '%'.$request->string('search')->trim().'%');
            })
            ->orderByDesc('created_at')
            ->paginate(25);

        return response()->json([
            'data' => $epks->through(fn (Epk $epk) => [
                'id' => $epk->id,
                'title' => $epk->title,
                'slug' => $epk->slug,
                'status' => $epk->status,
                'workspace' => $epk->workspace ? ['id' => $epk->workspace->id, 'name' => $epk->workspace->name] : null,
                'artist' => $epk->artist ? ['id' => $epk->artist->id, 'name' => $epk->artist->name] : null,
                'published_at' => $epk->published_at,
                'created_at' => $epk->created_at,
            ])->items(),
            'meta' => [
                'current_page' => $epks->currentPage(),
                'last_page' => $epks->lastPage(),
                'total' => $epks->total(),
            ],
        ]);
    }

    public function unpublish(Request $request, Epk $epk, AuditLogger $auditLogger): JsonResponse
    {
        $epk->update(['status' => EpkStatus::Draft, 'published_at' => null]);
        $auditLogger->log($request, 'epk.unpublished_by_admin', $epk, ['title' => $epk->title]);

        return response()->json(['data' => ['id' => $epk->id, 'status' => $epk->status]]);
    }
}
