<?php

namespace App\Models;

use App\Enums\MediaType;
use Database\Factories\MediaFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\Storage;

class Media extends Model
{
    /** @use HasFactory<MediaFactory> */
    use HasFactory, SoftDeletes;

    protected $table = 'media';

    protected $fillable = [
        'workspace_id',
        'uploaded_by',
        'disk',
        'filename',
        'original_filename',
        'path',
        'thumbnail_path',
        'mime_type',
        'type',
        'size',
        'metadata',
    ];

    protected function casts(): array
    {
        return [
            'type' => MediaType::class,
            'metadata' => 'array',
            'size' => 'integer',
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
     * @return BelongsTo<User, $this>
     */
    public function uploader(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }

    public function url(): string
    {
        return Storage::disk($this->disk)->url($this->path);
    }

    public function thumbnailUrl(): ?string
    {
        return $this->thumbnail_path ? Storage::disk($this->disk)->url($this->thumbnail_path) : null;
    }

    /**
     * The file's real extension, derived from the securely stored `filename`
     * (set once at upload, never touched afterward) — not from
     * `original_filename`, which the user can rename freely. This is what
     * rename normalizes against, so a renamed file can never end up with a
     * missing or mismatched extension.
     */
    public function extension(): string
    {
        return pathinfo($this->filename, PATHINFO_EXTENSION);
    }
}
