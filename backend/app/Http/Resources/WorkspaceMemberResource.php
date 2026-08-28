<?php

namespace App\Http\Resources;

use App\Models\WorkspaceMember;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin WorkspaceMember */
class WorkspaceMemberResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'role' => $this->role,
            'status' => $this->status,
            'email' => $this->user?->email ?? $this->invited_email,
            'user' => new UserResource($this->whenLoaded('user')),
            'invited_by' => new UserResource($this->whenLoaded('inviter')),
            'joined_at' => $this->joined_at,
            'created_at' => $this->created_at,
        ];
    }
}
