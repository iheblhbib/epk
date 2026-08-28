<?php

namespace App\Http\Resources;

use App\Models\EpkSection;
use App\Services\PublicSectionConfigResolver;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin EpkSection */
class PublicEpkSectionResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'type' => $this->type,
            'title' => $this->title ?: $this->type->label(),
            'config' => app(PublicSectionConfigResolver::class)->resolve($this->resource),
        ];
    }
}
