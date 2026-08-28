<?php

namespace App\Enums;

enum SectionType: string
{
    case Hero = 'hero';
    case Biography = 'biography';
    case Photos = 'photos';
    case Music = 'music';
    case Releases = 'releases';
    case Videos = 'videos';
    case Press = 'press';
    case Events = 'events';
    case SocialNetworks = 'social_networks';
    case Contact = 'contact';
    case Downloads = 'downloads';
    case Credits = 'credits';
    case Custom = 'custom';

    public function label(): string
    {
        return match ($this) {
            self::Hero => 'Hero',
            self::Biography => 'Biography',
            self::Photos => 'Photos',
            self::Music => 'Music',
            self::Releases => 'Releases',
            self::Videos => 'Videos',
            self::Press => 'Press',
            self::Events => 'Events',
            self::SocialNetworks => 'Social Networks',
            self::Contact => 'Contact',
            self::Downloads => 'Downloads',
            self::Credits => 'Credits',
            self::Custom => 'Custom Section',
        };
    }

    /**
     * Only one Hero section makes sense (it's the page's top banner) — every
     * other type may appear multiple times in one EPK.
     */
    public function isSingleton(): bool
    {
        return $this === self::Hero;
    }

    /**
     * Sensible starting config so a freshly added section isn't empty.
     *
     * @return array<string, mixed>
     */
    public function defaultConfig(): array
    {
        return match ($this) {
            self::Hero => [
                'headline' => '',
                'subtitle' => '',
                'description' => '',
                'profile_media_id' => null,
                'background_media_id' => null,
                'alignment' => 'center',
                'height' => 'large',
                'overlay' => true,
                'cta_label' => '',
                'cta_url' => '',
            ],
            self::Biography => ['html' => ''],
            self::SocialNetworks => ['links' => []],
            self::Contact => [
                'booking_email' => '',
                'press_email' => '',
                'management_email' => '',
                'phone' => '',
                'website' => '',
                'address' => '',
                'show_phone' => false,
                'show_address' => false,
            ],
            self::Downloads => ['media_ids' => []],
            self::Credits => ['items' => []],
            self::Custom => ['heading' => '', 'html' => ''],
            self::Photos => ['items' => []],
            self::Music => ['tracks' => []],
            self::Releases => ['releases' => []],
            self::Videos => ['videos' => []],
            self::Press => ['items' => []],
            self::Events => [],
        };
    }
}
