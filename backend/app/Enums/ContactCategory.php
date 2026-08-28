<?php

namespace App\Enums;

enum ContactCategory: string
{
    case Journalist = 'journalist';
    case Radio = 'radio';
    case Blog = 'blog';
    case Label = 'label';
    case Booking = 'booking';
    case Management = 'management';
    case Pr = 'pr';
    case Other = 'other';

    public function label(): string
    {
        return match ($this) {
            self::Journalist => 'Journalist',
            self::Radio => 'Radio',
            self::Blog => 'Blog',
            self::Label => 'Label',
            self::Booking => 'Booking',
            self::Management => 'Management',
            self::Pr => 'PR',
            self::Other => 'Other',
        };
    }
}
