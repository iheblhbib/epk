<?php

namespace App\Http\Resources;

use App\Models\Epk;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Epk */
class PublicEpkResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'title' => $this->title,
            'theme' => $this->theme,
            'custom_settings' => $this->custom_settings,
            'seo_title' => $this->seo_title,
            'seo_description' => $this->seo_description,
            'cover_image_url' => $this->cover_image_path ? asset('storage/'.$this->cover_image_path) : null,
            'published_at' => $this->published_at,
            'artist' => new ArtistResource($this->whenLoaded('artist')),
            'sections' => PublicEpkSectionResource::collection($this->whenLoaded('sections')),
        ];
    }
}
