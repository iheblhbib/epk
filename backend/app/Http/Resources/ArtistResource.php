<?php

namespace App\Http\Resources;

use App\Models\Artist;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Artist */
class ArtistResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'workspace_id' => $this->workspace_id,
            'name' => $this->name,
            'stage_name' => $this->stage_name,
            'short_bio' => $this->short_bio,
            'country' => $this->country,
            'city' => $this->city,
            'genre' => $this->genre,
            'website' => $this->website,
            'booking_email' => $this->booking_email,
            'press_email' => $this->press_email,
            'management_email' => $this->management_email,
            'profile_image_url' => $this->profile_image_path ? asset('storage/'.$this->profile_image_path) : null,
            'cover_image_url' => $this->cover_image_path ? asset('storage/'.$this->cover_image_path) : null,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
