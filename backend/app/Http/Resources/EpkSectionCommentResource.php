<?php

namespace App\Http\Resources;

use App\Models\EpkSectionComment;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin EpkSectionComment */
class EpkSectionCommentResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'epk_section_id' => $this->epk_section_id,
            'body' => $this->body,
            // Null once the author's account has been deleted (user_id is
            // nullOnDelete) — the comment itself survives, just anonymized.
            // Controllers eager-load 'user' so this never N+1s across a list.
            'user' => $this->user ? new UserResource($this->user) : null,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
