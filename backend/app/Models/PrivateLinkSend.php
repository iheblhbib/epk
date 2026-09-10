<?php

namespace App\Models;

use Database\Factories\PrivateLinkSendFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One record of a private link being emailed to someone — append-only, like
 * AuditLog (no updated_at). Powers the "Sent to jane@…, bob@…" list on the
 * link row in the builder.
 */
class PrivateLinkSend extends Model
{
    /** @use HasFactory<PrivateLinkSendFactory> */
    use HasFactory;

    public const UPDATED_AT = null;

    protected $fillable = [
        'private_link_id',
        'sent_by',
        'recipient_email',
        'recipient_name',
        'message',
        'included_password',
    ];

    protected function casts(): array
    {
        return [
            'included_password' => 'boolean',
            'created_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<PrivateLink, $this>
     */
    public function privateLink(): BelongsTo
    {
        return $this->belongsTo(PrivateLink::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function sender(): BelongsTo
    {
        return $this->belongsTo(User::class, 'sent_by');
    }
}
