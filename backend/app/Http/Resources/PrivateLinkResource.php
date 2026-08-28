<?php

namespace App\Http\Resources;

use App\Models\PrivateLink;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin PrivateLink */
class PrivateLinkResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'label' => $this->label,
            'private_url' => "/private/{$this->token}",
            'requires_password' => $this->requiresPassword(),
            'expires_at' => $this->expires_at,
            'revoked_at' => $this->revoked_at,
            'is_active' => $this->isActive(),
            'view_count' => $this->view_count,
            'last_viewed_at' => $this->last_viewed_at,
            'created_at' => $this->created_at,
        ];
    }
}
