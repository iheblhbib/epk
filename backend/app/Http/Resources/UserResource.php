<?php

namespace App\Http\Resources;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin User */
class UserResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,
            'role' => $this->role,
            'locale' => $this->locale,
            'avatar_url' => $this->avatar_path ? asset('storage/'.$this->avatar_path) : null,
            'email_verified_at' => $this->email_verified_at,
            'suspended_at' => $this->suspended_at,
            'two_factor_enabled' => $this->hasEnabledTwoFactorAuthentication(),
            'created_at' => $this->created_at,
        ];
    }
}
