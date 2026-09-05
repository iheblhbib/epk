<?php

namespace App\Services;

use App\Enums\MediaType;
use App\Models\Media;
use App\Models\Workspace;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Intervention\Image\Encoders\FileExtensionEncoder;
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
        $size = $file->getSize();

        if ($type === MediaType::Image) {
            [$thumbnailPath, $metadata] = $this->processImage($path, $directory, $filename, $extension);
            // The resize above overwrites $path in place, so the original
            // upload size no longer matches what's actually on disk.
            $size = Storage::disk('public')->size($path);
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
            'size' => $size,
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
     * Caps the stored original's dimensions (downscale only, never upscale —
     * scaleDown() is a no-op below the cap) before generating its thumbnail,
     * so an oversized phone photo doesn't sit at full resolution on disk for
     * no benefit on a web page. Both steps reuse the same decoded $image
     * rather than decoding the file twice.
     *
     * @return array{0: string, 1: array<string, int>}
     */
    private function processImage(string $path, string $directory, string $filename, string $extension): array
    {
        $disk = Storage::disk('public');
        $image = Image::decodePath($disk->path($path));

        $maxDimension = (int) config('media.max_image_dimension', 2500);
        $image->scaleDown(width: $maxDimension, height: $maxDimension);
        $disk->put($path, (string) $image->encode(new FileExtensionEncoder($extension, quality: 85)));

        $metadata = ['width' => $image->width(), 'height' => $image->height()];

        $thumbnailWidth = (int) config('media.thumbnail_width', 400);
        $thumbnail = $image->scaleDown(width: $thumbnailWidth);

        $thumbnailFilename = pathinfo($filename, PATHINFO_FILENAME).'-thumb.webp';
        $thumbnailPath = "{$directory}/{$thumbnailFilename}";

        $disk->put($thumbnailPath, (string) $thumbnail->encode(new WebpEncoder(quality: 80)));

        return [$thumbnailPath, $metadata];
    }
}
