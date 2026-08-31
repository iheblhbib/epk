<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Notifications\DatabaseNotification;

/** @mixin DatabaseNotification */
class NotificationResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            // 'kind' (from the payload) is what the frontend switches on —
            // see WorkspaceInvitationNotification::toDatabase() — keeping it
            // decoupled from Laravel's own `type` column, which stores the
            // full PHP class name.
            'kind' => $this->data['kind'] ?? null,
            // Named 'payload' rather than 'data': a field literally called
            // 'data' collides with JsonResource's own top-level 'data' wrap
            // key, and Laravel silently skips wrapping the whole response
            // to avoid producing 'data.data' — breaking every other
            // resource's `{ data: T }` envelope convention this app relies
            // on throughout the frontend.
            'payload' => $this->data,
            'read_at' => $this->read_at,
            'created_at' => $this->created_at,
        ];
    }
}
