<?php

namespace App\Enums;

enum MediaType: string
{
    case Image = 'image';
    case Audio = 'audio';
    case Video = 'video';
    case Document = 'document';

    /**
     * Map a validated file extension to its media type. Extensions are
     * whitelisted in StoreMediaRequest — this must stay in sync with it.
     */
    public static function fromExtension(string $extension): self
    {
        return match (strtolower($extension)) {
            'jpg', 'jpeg', 'png', 'webp' => self::Image,
            'mp3', 'wav', 'flac' => self::Audio,
            'mp4', 'mov' => self::Video,
            'pdf', 'docx' => self::Document,
            default => throw new \InvalidArgumentException("Unsupported file extension: {$extension}"),
        };
    }
}
