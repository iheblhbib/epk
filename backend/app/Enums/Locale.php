<?php

namespace App\Enums;

enum Locale: string
{
    case English = 'en';
    case French = 'fr';
    case Arabic = 'ar';
    case Spanish = 'es';
    case Portuguese = 'pt';
    case German = 'de';
    case Chinese = 'zh';

    public function label(): string
    {
        return match ($this) {
            self::English => 'English',
            self::French => 'Français',
            self::Arabic => 'العربية',
            self::Spanish => 'Español',
            self::Portuguese => 'Português',
            self::German => 'Deutsch',
            self::Chinese => '中文',
        };
    }

    public function isRtl(): bool
    {
        return $this === self::Arabic;
    }
}
