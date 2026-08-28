<?php

namespace App\Models;

use Database\Factories\PrivateLinkFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class PrivateLink extends Model
{
    /** @use HasFactory<PrivateLinkFactory> */
    use HasFactory;

    protected $fillable = [
        'epk_id',
        'created_by',
        'token',
        'label',
        'password_hash',
        'expires_at',
        'revoked_at',
        'view_count',
        'last_viewed_at',
    ];

    protected static function booted(): void
    {
        static::creating(function (PrivateLink $link) {
            $link->token ??= Str::random(40);
        });
    }

    protected function casts(): array
    {
        return [
            'expires_at' => 'datetime',
            'revoked_at' => 'datetime',
            'last_viewed_at' => 'datetime',
            'view_count' => 'integer',
        ];
    }

    /**
     * @return BelongsTo<Epk, $this>
     */
    public function epk(): BelongsTo
    {
        return $this->belongsTo(Epk::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function isExpired(): bool
    {
        return $this->expires_at !== null && $this->expires_at->isPast();
    }

    public function isRevoked(): bool
    {
        return $this->revoked_at !== null;
    }

    public function isActive(): bool
    {
        return ! $this->isExpired() && ! $this->isRevoked();
    }

    public function requiresPassword(): bool
    {
        return $this->password_hash !== null;
    }

    public function checkPassword(string $password): bool
    {
        return $this->password_hash !== null && Hash::check($password, $this->password_hash);
    }

    public function setPassword(?string $password): void
    {
        $this->password_hash = $password !== null && $password !== '' ? Hash::make($password) : null;
    }

    public function recordView(): void
    {
        $this->increment('view_count', 1, ['last_viewed_at' => now()]);
    }
}
