<?php

namespace App\Services;

use App\Models\Media;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;
use ZipArchive;

/**
 * Bundles a set of Media rows into a single streamed .zip download --
 * shared between PublicEpkController and PrivatePageController's "download
 * all music" endpoints, since the actual zip-building/streaming logic is
 * identical between them (only how each controller resolves *which* media
 * ids are allowed differs, per their own access rules).
 */
class MusicZipBuilder
{
    /**
     * @param  Collection<int, Media>  $mediaItems
     */
    public function stream(Collection $mediaItems, string $downloadFilename): StreamedResponse
    {
        $tempPath = tempnam(sys_get_temp_dir(), 'epk-music-zip-');

        $zip = new ZipArchive;
        $zip->open($tempPath, ZipArchive::OVERWRITE);

        $usedNames = [];
        foreach ($mediaItems as $media) {
            $zip->addFromString($this->uniqueNameFor($media->original_filename, $usedNames), Storage::disk($media->disk)->get($media->path));
        }

        $zip->close();

        return new StreamedResponse(function () use ($tempPath) {
            readfile($tempPath);
            unlink($tempPath);
        }, 200, [
            'Content-Type' => 'application/zip',
            'Content-Disposition' => 'attachment; filename="'.$downloadFilename.'"',
        ]);
    }

    /**
     * Two tracks can genuinely share an original filename (e.g. both
     * exported from the same DAW as "master.wav") -- ZipArchive::addFromString
     * silently overwrites an entry with the same name, which would drop a
     * file from the download without any error. Appends " (2)", " (3)", etc.
     * onto the *name*, preserving the extension, exactly like a browser's
     * own "file already exists" download renaming.
     *
     * @param  array<string, true>  $usedNames  mutated in place
     */
    private function uniqueNameFor(string $filename, array &$usedNames): string
    {
        if (! isset($usedNames[$filename])) {
            $usedNames[$filename] = true;

            return $filename;
        }

        $extension = pathinfo($filename, PATHINFO_EXTENSION);
        $base = pathinfo($filename, PATHINFO_FILENAME);

        for ($i = 2; ; $i++) {
            $candidate = $extension !== '' ? "{$base} ({$i}).{$extension}" : "{$base} ({$i})";
            if (! isset($usedNames[$candidate])) {
                $usedNames[$candidate] = true;

                return $candidate;
            }
        }
    }
}
