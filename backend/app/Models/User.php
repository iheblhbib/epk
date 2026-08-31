<?php

namespace App\Models;

use App\Enums\Locale;
use App\Enums\UserRole;
use Database\Factories\UserFactory;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable implements MustVerifyEmail
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, Notifiable;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'email',
        'password',
        'role',
        'avatar_path',
        'locale',
        'notification_preferences',
        'two_factor_secret',
        'two_factor_recovery_codes',
        'two_factor_confirmed_at',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
        'two_factor_secret',
        'two_factor_recovery_codes',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'suspended_at' => 'datetime',
            'password' => 'hashed',
            'role' => UserRole::class,
            'locale' => Locale::class,
            'notification_preferences' => 'array',
            'two_factor_secret' => 'encrypted',
            'two_factor_recovery_codes' => 'encrypted:array',
            'two_factor_confirmed_at' => 'datetime',
        ];
    }

    public function isAdmin(): bool
    {
        return $this->role === UserRole::Admin;
    }

    /**
     * Whether login should stop at the credentials step or go on to demand
     * a TOTP/recovery code — see AuthenticatedSessionController and
     * TwoFactorChallengeController. A generated-but-not-yet-confirmed
     * secret doesn't count, so an abandoned setup never locks the owner out.
     */
    public function hasEnabledTwoFactorAuthentication(): bool
    {
        return $this->two_factor_confirmed_at !== null;
    }

    /**
     * Whether this user wants a given notification kind delivered on a
     * given channel. Defaults to true (opt-out, not opt-in) so accounts
     * that have never visited Settings > Notifications keep receiving
     * everything they already received before this preference existed.
     */
    public function wantsNotificationChannel(string $kind, string $channel): bool
    {
        return (bool) ($this->notification_preferences[$kind][$channel] ?? true);
    }

    /**
     * @return BelongsToMany<Workspace, $this>
     */
    public function workspaces(): BelongsToMany
    {
        return $this->belongsToMany(Workspace::class, 'workspace_members')
            ->withPivot(['role', 'status'])
            ->withTimestamps();
    }
}
