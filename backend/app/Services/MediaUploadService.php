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
        $directory = "workspaces/{$workspace->id}/media/{$type->value}";

        $thumbnailPath = null;
        $metadata = [];
        $mimeType = $file->getMimeType();
        $originalFilename = $file->getClientOriginalName();

        if ($type === MediaType::Image) {
            // Every image is normalized to WebP, at a reduced quality --
            // it beats JPEG/PNG at matching visual quality for meaningfully
            // less storage, which matters on shared-hosting quotas. Both the
            // securely-random stored filename and the client-facing name get
            // the .webp extension, so a downloaded file's name always
            // matches its real content -- never a ".jpg" that's actually
            // WebP bytes.
            $filename = Str::random(40).'.webp';
            $path = "{$directory}/{$filename}";
            [$metadata, $thumbnailPath] = $this->processImage($file, $path, $directory, $filename);
            $mimeType = 'image/webp';
            $originalFilename = pathinfo($originalFilename, PATHINFO_FILENAME).'.webp';
        } else {
            $filename = Str::random(40).'.'.$extension;
            $path = $file->storeAs($directory, $filename, 'public');
        }

        return Media::create([
            'workspace_id' => $workspace->id,
            'uploaded_by' => $uploadedById,
            'disk' => 'public',
            'filename' => $filename,
            'original_filename' => $originalFilename,
            'path' => $path,
            'thumbnail_path' => $thumbnailPath,
            'mime_type' => $mimeType,
            'type' => $type,
            'size' => Storage::disk('public')->size($path),
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
     * Decodes straight from the upload's temp path (never writing the
     * pre-conversion original to disk at all, since every image is
     * converted below) and caps its dimensions (downscale only, never
     * upscale — scaleDown() is a no-op below the cap) before generating its
     * thumbnail, so an oversized phone photo doesn't sit at full resolution
     * on disk for no benefit on a web page. Both steps reuse the same
     * decoded $image rather than decoding twice.
     *
     * @return array{0: array<string, int>, 1: string}
     */
    private function processImage(UploadedFile $file, string $path, string $directory, string $filename): array
    {
        $disk = Storage::disk('public');
        $image = Image::decodePath($file->getRealPath());

        $maxDimension = (int) config('media.max_image_dimension', 2500);
        $image->scaleDown(width: $maxDimension, height: $maxDimension);

        $quality = (int) config('media.image_quality', 75);
        $disk->put($path, (string) $image->encode(new WebpEncoder(quality: $quality)));

        $metadata = ['width' => $image->width(), 'height' => $image->height()];

        $thumbnailWidth = (int) config('media.thumbnail_width', 400);
        $thumbnail = $image->scaleDown(width: $thumbnailWidth);

        $thumbnailFilename = pathinfo($filename, PATHINFO_FILENAME).'-thumb.webp';
        $thumbnailPath = "{$directory}/{$thumbnailFilename}";

        $disk->put($thumbnailPath, (string) $thumbnail->encode(new WebpEncoder(quality: 80)));

        return [$metadata, $thumbnailPath];
    }
}
