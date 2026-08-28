<?php

namespace App\Enums;

/**
 * The 5 base theme presets. Their actual token values (colors, fonts,
 * spacing, etc.) live entirely on the frontend — the backend only needs to
 * know which preset ids are valid, plus validate the shape of the
 * customizations layered on top (see UpdateEpkRequest::rules()).
 */
enum EpkTheme: string
{
    case Minimal = 'minimal';
    case Dark = 'dark';
    case Editorial = 'editorial';
    case Artist = 'artist';
    case Modern = 'modern';
}
