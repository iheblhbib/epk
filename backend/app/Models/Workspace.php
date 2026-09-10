<?php

namespace App\Models;

use App\Enums\SubscriptionPlan;
use App\Enums\SubscriptionStatus;
use Database\Factories\WorkspaceFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;

class Workspace extends Model
{
    /** @use HasFactory<WorkspaceFactory> */
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'name',
        'slug',
        'description',
        'logo_path',
        'created_by',
    ];

    protected static function booted(): void
    {
        // Every new workspace gets a 14-day trial at Starter-tier limits
        // and features, no Stripe interaction at all -- see docs/superpowers/
        // specs/2026-09-02-subscription-billing-overhaul-design.md. The trial
        // is a taste of the entry tier: Pro/Business features (private links,
        // custom themes, custom domains) stay locked until the workspace
        // actually subscribes. The access-gate middleware
        // (EnsureSubscriptionIsActive) enforces the 14-day cutoff; this just
        // sets it up.
        static::created(function (Workspace $workspace) {
            $workspace->subscription()->create([
                'plan' => SubscriptionPlan::Starter,
                'status' => SubscriptionStatus::Trialing,
                'trial_ends_at' => now()->addDays(14),
            ]);
        });
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * @return HasMany<WorkspaceMember, $this>
     */
    public function members(): HasMany
    {
        return $this->hasMany(WorkspaceMember::class);
    }

    /**
     * @return HasMany<Artist, $this>
     */
    public function artists(): HasMany
    {
        return $this->hasMany(Artist::class);
    }

    /**
     * @return HasMany<Epk, $this>
     */
    public function epks(): HasMany
    {
        return $this->hasMany(Epk::class);
    }

    /**
     * @return HasMany<Media, $this>
     */
    public function media(): HasMany
    {
        return $this->hasMany(Media::class);
    }

    /**
     * @return HasMany<Contact, $this>
     */
    public function contacts(): HasMany
    {
        return $this->hasMany(Contact::class);
    }

    /**
     * @return HasOne<Subscription, $this>
     */
    public function subscription(): HasOne
    {
        return $this->hasOne(Subscription::class);
    }
}
