<?php

namespace App\Services;

use App\Enums\MediaType;
use App\Models\Media;
use App\Models\Workspace;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Intervention\Image\Encoders\WebpEncoder;
use Intervention\Image\Laravel\Facades\Image;

class MediaUploadService
{
    /**
     * Store an uploaded file securely and create its Media record.
     *
     * The stored filename is always a random string — never the client's
     * original filename — so nothing about the upload path is attacker
     * controlled (no path traversal, no overwriting another file, no
     * disguising an executable behind a trusted-looking name).
     */
    public function store(UploadedFile $file, Workspace $workspace, ?int $uploadedById): Media
    {
        $extension = strtolower($file->getClientOriginalExtension());
        $type = MediaType::fromExtension($extension);

        $filename = Str::random(40).'.'.$extension;
        $directory = "workspaces/{$workspace->id}/media/{$type->value}";

        $path = $file->storeAs($directory, $filename, 'public');

        $thumbnailPath = null;
        $metadata = [];

        if ($type === MediaType::Image) {
            [$thumbnailPath, $metadata] = $this->makeImageThumbnail($path, $directory, $filename);
        }

        return Media::create([
            'workspace_id' => $workspace->id,
            'uploaded_by' => $uploadedById,
            'disk' => 'public',
            'filename' => $filename,
            'original_filename' => $file->getClientOriginalName(),
            'path' => $path,
            'thumbnail_path' => $thumbnailPath,
            'mime_type' => $file->getMimeType(),
            'type' => $type,
            'size' => $file->getSize(),
            'metadata' => $metadata ?: null,
        ]);
    }

    public function delete(Media $media): void
    {
        $disk = Storage::disk($media->disk);
        $disk->delete($media->path);

        if ($media->thumbnail_path) {
            $disk->delete($media->thumbnail_path);
        }
    }

    /**
     * @return array{0: string, 1: array<string, int>}
     */
    private function makeImageThumbnail(string $path, string $directory, string $filename): array
    {
        $disk = Storage::disk('public');
        $image = Image::decodePath($disk->path($path));

        $metadata = ['width' => $image->width(), 'height' => $image->height()];

        $thumbnailWidth = (int) config('media.thumbnail_width', 400);
        $thumbnail = $image->scaleDown(width: $thumbnailWidth);

        $thumbnailFilename = pathinfo($filename, PATHINFO_FILENAME).'-thumb.webp';
        $thumbnailPath = "{$directory}/{$thumbnailFilename}";

        $disk->put($thumbnailPath, (string) $thumbnail->encode(new WebpEncoder(quality: 80)));

        return [$thumbnailPath, $metadata];
    }
}
