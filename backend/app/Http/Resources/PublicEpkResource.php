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
            // Already public either way (it's literally the URL segment on
            // the non-custom-domain page) — exposed here too so a visitor
            // arriving via a custom domain can still hit the slug-keyed
            // PDF/download/analytics-event endpoints (see
            // frontend's CustomDomainEpkPage).
            'slug' => $this->slug,
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
