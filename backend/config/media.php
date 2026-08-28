<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Allowed Extensions
    |--------------------------------------------------------------------------
    |
    | The only file extensions the media library will accept, grouped by the
    | App\Enums\MediaType they map to (keep MediaType::fromExtension() in
    | sync with this list). Laravel's "mimes" validation rule checks the
    | actual file content (via fileinfo), not the client-supplied extension
    | or Content-Type header, so this is a real content-based whitelist —
    | not just a filename check.
    |
    */

    'allowed_extensions' => [
        'jpg', 'jpeg', 'png', 'webp',   // image
        'mp3', 'wav', 'flac',           // audio
        'mp4', 'mov',                   // video
        'pdf', 'docx',                  // document
    ],

    /*
    |--------------------------------------------------------------------------
    | Max Upload Size (kilobytes)
    |--------------------------------------------------------------------------
    |
    | Per media type, enforced server-side via validation regardless of what
    | the frontend already restricts.
    |
    */

    'max_size_kb' => [
        'image' => 10 * 1024,
        'audio' => 50 * 1024,
        'video' => 200 * 1024,
        'document' => 20 * 1024,
    ],

    /*
    |--------------------------------------------------------------------------
    | Image Thumbnail
    |--------------------------------------------------------------------------
    */

    'thumbnail_width' => 400,

];
