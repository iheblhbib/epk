<?php

namespace App\Http\Resources;

use App\Enums\EpkStatus;
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
            'custom_domain' => $this->custom_domain,
            'custom_domain_verified' => $this->hasVerifiedCustomDomain(),
            'public_url' => "/epk/{$this->slug}",
            // Only meaningful once published — the share page 404s the same
            // way the public API does for a draft/archived EPK, so there's
            // nothing useful to link to before then. See PublicEpkShareController.
            'share_url' => $this->status === EpkStatus::Published ? route('epk.share', $this->slug) : null,
            'published_at' => $this->published_at,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
