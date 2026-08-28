<?php

namespace App\Http\Resources;

use App\Models\EpkSection;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin EpkSection */
class EpkSectionResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'epk_id' => $this->epk_id,
            'type' => $this->type,
            'label' => $this->type->label(),
            'title' => $this->title,
            'is_enabled' => $this->is_enabled,
            'position' => $this->position,
            'config' => $this->config,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
