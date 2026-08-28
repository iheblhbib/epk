<?php

namespace App\Models;

use App\Enums\EpkStatus;
use Database\Factories\EpkFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

class Epk extends Model
{
    /** @use HasFactory<EpkFactory> */
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'workspace_id',
        'artist_id',
        'title',
        'slug',
        'status',
        'cover_image_path',
        'theme',
        'custom_settings',
        'seo_title',
        'seo_description',
        'published_at',
    ];

    protected static function booted(): void
    {
        static::creating(function (Epk $epk) {
            $epk->uuid ??= (string) Str::uuid();
        });
    }

    protected function casts(): array
    {
        return [
            'status' => EpkStatus::class,
            'custom_settings' => 'array',
            'published_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<Workspace, $this>
     */
    public function workspace(): BelongsTo
    {
        return $this->belongsTo(Workspace::class);
    }

    /**
     * @return BelongsTo<Artist, $this>
     */
    public function artist(): BelongsTo
    {
        return $this->belongsTo(Artist::class);
    }

    /**
     * @return HasMany<EpkSection, $this>
     */
    public function sections(): HasMany
    {
        return $this->hasMany(EpkSection::class)->orderBy('position');
    }

    /**
     * @return HasMany<AnalyticsEvent, $this>
     */
    public function analyticsEvents(): HasMany
    {
        return $this->hasMany(AnalyticsEvent::class);
    }

    /**
     * @return HasMany<PrivateLink, $this>
     */
    public function privateLinks(): HasMany
    {
        return $this->hasMany(PrivateLink::class);
    }

    /**
     * Scopes to EPKs the public should be able to see at all — used by both
     * the public show endpoint and the public event-tracking endpoint, so a
     * draft/archived EPK's slug 404s in exactly the same way from either.
     *
     * @param  Builder<Epk>  $query
     * @return Builder<Epk>
     */
    public function scopePublished(Builder $query): Builder
    {
        return $query->where('status', EpkStatus::Published->value);
    }
}
