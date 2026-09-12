<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Http\JsonResponse;

class AdminActivityController extends Controller
{
    /**
     * Recent signups and recent workspace creations, interleaved by date,
     * newest first. Deliberately not the AuditLog (a different feature --
     * it tracks admin/moderation and content actions, not platform growth
     * events) and not cached: this is a short, cheap query an admin expects
     * to be fresh on every load, unlike the heavier 60s-cached stats blob.
     */
    public function index(): JsonResponse
    {
        $users = User::latest()->take(10)->get(['id', 'name', 'email', 'created_at'])
            ->map(fn (User $user) => [
                'kind' => 'user_signed_up',
                'label' => $user->name,
                'detail' => $user->email,
                'created_at' => $user->created_at,
            ]);

        $workspaces = Workspace::with('creator:id,name')->latest()->take(10)->get(['id', 'name', 'created_by', 'created_at'])
            ->map(fn (Workspace $workspace) => [
                'kind' => 'workspace_created',
                'label' => $workspace->name,
                'detail' => $workspace->creator?->name,
                'created_at' => $workspace->created_at,
            ]);

        $activity = $users->concat($workspaces)
            ->sortByDesc('created_at')
            ->take(10)
            ->values();

        return response()->json(['data' => $activity]);
    }
}
