<?php

namespace App\Models;

use Database\Factories\EpkSectionCommentFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class EpkSectionComment extends Model
{
    /** @use HasFactory<EpkSectionCommentFactory> */
    use HasFactory;

    protected $fillable = [
        'epk_section_id',
        'user_id',
        'body',
    ];

    /**
     * @return BelongsTo<EpkSection, $this>
     */
    public function section(): BelongsTo
    {
        return $this->belongsTo(EpkSection::class, 'epk_section_id');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
