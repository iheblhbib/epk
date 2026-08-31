<?php

namespace App\Http\Controllers\Api;

use App\Enums\WorkspaceMemberStatus;
use App\Enums\WorkspaceRole;
use App\Http\Controllers\Controller;
use App\Http\Requests\StoreWorkspaceRequest;
use App\Http\Requests\UpdateWorkspaceRequest;
use App\Http\Resources\WorkspaceResource;
use App\Models\Workspace;
use App\Services\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class WorkspaceController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $workspaces = $request->user()
            ->workspaces()
            ->wherePivot('status', WorkspaceMemberStatus::Active)
            ->withCount('members')
            ->get();

        return WorkspaceResource::collection($workspaces)->response();
    }

    public function store(StoreWorkspaceRequest $request): JsonResponse
    {
        $workspace = Workspace::create([
            'name' => $request->validated('name'),
            'slug' => $this->uniqueSlug($request->validated('name')),
            'description' => $request->validated('description'),
            'created_by' => $request->user()->id,
        ]);

        $workspace->members()->create([
            'user_id' => $request->user()->id,
            'role' => WorkspaceRole::Owner,
            'status' => WorkspaceMemberStatus::Active,
            'joined_at' => now(),
        ]);

        return (new WorkspaceResource($workspace->fresh('members')))->response()->setStatusCode(201);
    }

    public function show(Workspace $workspace): JsonResponse
    {
        $this->authorize('view', $workspace);

        return (new WorkspaceResource($workspace->loadCount('members')))->response();
    }

    public function update(UpdateWorkspaceRequest $request, Workspace $workspace, AuditLogger $auditLogger): JsonResponse
    {
        $workspace->update($request->validated());

        $auditLogger->log($request, 'workspace.updated', $workspace, $request->validated(), $workspace->id);

        return (new WorkspaceResource($workspace))->response();
    }

    public function destroy(Workspace $workspace): JsonResponse
    {
        $this->authorize('delete', $workspace);

        $workspace->delete();

        return response()->json(['message' => __('Workspace deleted.')]);
    }

    public function leave(Request $request, Workspace $workspace): JsonResponse
    {
        $this->authorize('leave', $workspace);

        $workspace->members()->where('user_id', $request->user()->id)->delete();

        return response()->json(['message' => __('You have left the workspace.')]);
    }

    private function uniqueSlug(string $name): string
    {
        $base = Str::slug($name) ?: 'workspace';
        $slug = $base;
        $suffix = 1;

        while (Workspace::withTrashed()->where('slug', $slug)->exists()) {
            $slug = "{$base}-".++$suffix;
        }

        return $slug;
    }
}
