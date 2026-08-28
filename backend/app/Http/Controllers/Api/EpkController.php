<?php

namespace App\Http\Controllers\Api;

use App\Enums\EpkStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\StoreEpkRequest;
use App\Http\Requests\UpdateEpkRequest;
use App\Http\Resources\EpkResource;
use App\Models\Epk;
use App\Models\Workspace;
use App\Services\PlanLimits;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class EpkController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $workspace = Workspace::findOrFail($request->query('workspace_id'));
        $this->authorize('viewAny', [Epk::class, $workspace]);

        $epks = $workspace->epks()->with('artist')->latest()->get();

        return EpkResource::collection($epks)->response();
    }

    public function store(StoreEpkRequest $request, PlanLimits $planLimits): JsonResponse
    {
        $workspace = Workspace::findOrFail($request->validated('workspace_id'));

        if (! $planLimits->canCreateEpk($workspace)) {
            throw ValidationException::withMessages([
                'workspace_id' => __('You\'ve reached the EPK limit for your current plan. Upgrade to create more.'),
            ]);
        }

        $epk = Epk::create([
            ...$request->validated(),
            'slug' => $this->uniqueSlug($request->validated('title')),
            'status' => EpkStatus::Draft,
        ]);

        return (new EpkResource($epk->load('artist')))->response()->setStatusCode(201);
    }

    public function show(Epk $epk): JsonResponse
    {
        $this->authorize('view', $epk);

        return (new EpkResource($epk->load('artist')))->response();
    }

    public function update(UpdateEpkRequest $request, Epk $epk, PlanLimits $planLimits): JsonResponse
    {
        $data = $request->validated();

        if (isset($data['title']) && $data['title'] !== $epk->title) {
            $data['slug'] = $this->uniqueSlug($data['title']);
        }

        // Every plan can still pick any of the 5 presets (the `theme` field)
        // — only per-axis overrides are gated, so a downgraded workspace
        // keeps a coherent look rather than losing its theme entirely.
        if (! empty($data['custom_settings']) && ! $planLimits->canUseCustomThemes($epk->workspace)) {
            throw ValidationException::withMessages([
                'custom_settings' => __('Custom theme overrides require the Pro plan or higher.'),
            ]);
        }

        $epk->update($data);

        return (new EpkResource($epk->load('artist')))->response();
    }

    public function destroy(Epk $epk): JsonResponse
    {
        $this->authorize('delete', $epk);

        $epk->delete();

        return response()->json(['message' => __('EPK deleted.')]);
    }

    public function duplicate(Epk $epk): JsonResponse
    {
        $this->authorize('duplicate', $epk);

        $copy = $epk->replicate(['uuid', 'slug', 'status', 'published_at']);
        $copy->title = "{$epk->title} (Copy)";
        $copy->slug = $this->uniqueSlug($copy->title);
        $copy->status = EpkStatus::Draft;
        $copy->published_at = null;
        $copy->save();

        return (new EpkResource($copy->load('artist')))->response()->setStatusCode(201);
    }

    public function publish(Epk $epk): JsonResponse
    {
        $this->authorize('publish', $epk);

        if ($epk->status === EpkStatus::Published) {
            throw ValidationException::withMessages([
                'status' => __('This EPK is already published.'),
            ]);
        }

        $epk->update(['status' => EpkStatus::Published, 'published_at' => now()]);

        return (new EpkResource($epk->load('artist')))->response();
    }

    public function unpublish(Epk $epk): JsonResponse
    {
        $this->authorize('publish', $epk);

        $epk->update(['status' => EpkStatus::Draft]);

        return (new EpkResource($epk->load('artist')))->response();
    }

    private function uniqueSlug(string $title): string
    {
        $base = Str::slug($title) ?: 'epk';
        $slug = $base;
        $suffix = 1;

        while (Epk::withTrashed()->where('slug', $slug)->exists()) {
            $slug = "{$base}-".++$suffix;
        }

        return $slug;
    }
}
