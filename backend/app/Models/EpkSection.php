<?php

namespace App\Models;

use App\Enums\SectionType;
use Database\Factories\EpkSectionFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class EpkSection extends Model
{
    /** @use HasFactory<EpkSectionFactory> */
    use HasFactory;

    protected $fillable = [
        'epk_id',
        'type',
        'title',
        'is_enabled',
        'position',
        'config',
    ];

    protected function casts(): array
    {
        return [
            'type' => SectionType::class,
            'is_enabled' => 'boolean',
            'position' => 'integer',
            'config' => 'array',
        ];
    }

    /**
     * @return BelongsTo<Epk, $this>
     */
    public function epk(): BelongsTo
    {
        return $this->belongsTo(Epk::class);
    }
}
