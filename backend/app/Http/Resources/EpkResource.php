<?php

namespace App\Http\Resources;

use App\Models\Epk;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Epk */
class EpkResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'uuid' => $this->uuid,
            'workspace_id' => $this->workspace_id,
            'artist' => new ArtistResource($this->whenLoaded('artist')),
            'title' => $this->title,
            'slug' => $this->slug,
            'status' => $this->status,
            'cover_image_url' => $this->cover_image_path ? asset('storage/'.$this->cover_image_path) : null,
            'theme' => $this->theme,
            'custom_settings' => $this->custom_settings,
            'seo_title' => $this->seo_title,
            'seo_description' => $this->seo_description,
            'public_url' => "/epk/{$this->slug}",
            'published_at' => $this->published_at,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
