<?php

namespace App\Models;

use App\Enums\AnalyticsEventType;
use App\Enums\DeviceType;
use Database\Factories\AnalyticsEventFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AnalyticsEvent extends Model
{
    /** @use HasFactory<AnalyticsEventFactory> */
    use HasFactory;

    // Append-only event log — nothing about an event is ever edited.
    const UPDATED_AT = null;

    protected $fillable = [
        'epk_id',
        'private_link_id',
        'type',
        'visitor_hash',
        'referrer_host',
        'country',
        'device_type',
        'browser',
        'os',
        'meta',
    ];

    protected function casts(): array
    {
        return [
            'type' => AnalyticsEventType::class,
            'device_type' => DeviceType::class,
            'meta' => 'array',
            'created_at' => 'datetime',
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
     * @return BelongsTo<PrivateLink, $this>
     */
    public function privateLink(): BelongsTo
    {
        return $this->belongsTo(PrivateLink::class);
    }
}
