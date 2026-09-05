<?php

namespace App\Enums;

enum MediaType: string
{
    case Image = 'image';
    case Audio = 'audio';
    case Document = 'document';

    /**
     * Map a validated file extension to its media type. Extensions are
     * whitelisted in StoreMediaRequest — this must stay in sync with it.
     *
     * No video case -- self-hosted video is not offered anywhere in the app
     * (the Video section only takes YouTube/Vimeo links), so mp4/mov are
     * unsupported extensions like any other.
     */
    public static function fromExtension(string $extension): self
    {
        return match (strtolower($extension)) {
            'jpg', 'jpeg', 'png', 'webp' => self::Image,
            'mp3', 'wav', 'flac' => self::Audio,
            'pdf', 'docx' => self::Document,
            default => throw new \InvalidArgumentException("Unsupported file extension: {$extension}"),
        };
    }
}
