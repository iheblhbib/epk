<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Workspace;
use Illuminate\Http\JsonResponse;

// Deliberately a plain array response, not a JsonResource — the same shape
// AdminAuditLogController already returns, just filtered down to one
// workspace's own entries instead of every workspace's admin-panel events.
class WorkspaceActivityLogController extends Controller
{
    public function index(Workspace $workspace): JsonResponse
    {
        $this->authorize('view', $workspace);

        $logs = AuditLog::query()
            ->where('workspace_id', $workspace->id)
            ->with('user:id,name')
            ->orderByDesc('created_at')
            ->paginate(20);

        return response()->json([
            'data' => $logs->through(fn (AuditLog $log) => [
                'id' => $log->id,
                'action' => $log->action,
                'metadata' => $log->metadata,
                'user' => $log->user ? ['id' => $log->user->id, 'name' => $log->user->name] : null,
                'created_at' => $log->created_at,
            ])->items(),
            'meta' => [
                'current_page' => $logs->currentPage(),
                'last_page' => $logs->lastPage(),
                'total' => $logs->total(),
            ],
        ]);
    }
}
