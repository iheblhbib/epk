<?php

namespace App\Http\Resources;

use App\Models\Media;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Media */
class MediaResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'workspace_id' => $this->workspace_id,
            'filename' => $this->filename,
            'original_filename' => $this->original_filename,
            'url' => $this->url(),
            'thumbnail_url' => $this->thumbnailUrl(),
            'mime_type' => $this->mime_type,
            'type' => $this->type,
            'size' => $this->size,
            'metadata' => $this->metadata,
            'uploaded_by' => new UserResource($this->whenLoaded('uploader')),
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
