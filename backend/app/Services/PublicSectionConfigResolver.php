<?php

namespace App\Services;

use App\Enums\SectionType;
use App\Models\EpkSection;
use App\Models\Media;
use App\Models\PrivateLink;

/**
 * Turns a section's raw builder config — which stores bare media_id
 * references and, for Contact, fields the artist may have chosen to hide —
 * into public-safe output. The public EPK page only ever sees the result of
 * this resolver, so it never needs an authenticated media lookup and can
 * never leak a contact field the artist toggled off.
 *
 * Bound as a singleton (see AppServiceProvider) so repeated media_id lookups
 * across sections in the same request are cached rather than re-queried.
 */
class PublicSectionConfigResolver
{
    /** @var array<int, Media|null> */
    private array $mediaCache = [];

    private ?PrivateLink $privateLink = null;

    /**
     * Called by PrivatePageController before resolving a private-link view,
     * so Downloads-section files get built into a download URL scoped to
     * that link/token rather than the public slug-based one (the public
     * download route only allows *published* EPKs, but a private link must
     * work for a draft EPK too).
     */
    public function forPrivateLink(?PrivateLink $privateLink): static
    {
        $this->privateLink = $privateLink;

        return $this;
    }

    /**
     * @return array<string, mixed>
     */
    public function resolve(EpkSection $section): array
    {
        $config = $section->config ?? [];

        return match ($section->type) {
            SectionType::Hero => [
                'headline' => $config['headline'] ?? '',
                'subtitle' => $config['subtitle'] ?? '',
                'description' => $config['description'] ?? '',
                'profile_image_url' => $this->urlFor($config['profile_media_id'] ?? null),
                'background_image_url' => $this->urlFor($config['background_media_id'] ?? null),
                'alignment' => $config['alignment'] ?? 'center',
                'height' => $config['height'] ?? 'large',
                'overlay' => $config['overlay'] ?? true,
                'cta_label' => $config['cta_label'] ?? '',
                'cta_url' => $config['cta_url'] ?? '',
            ],
            SectionType::Biography => [
                'html' => $config['html'] ?? '',
            ],
            SectionType::SocialNetworks => [
                'links' => $config['links'] ?? [],
            ],
            SectionType::Contact => [
                'booking_email' => $config['booking_email'] ?? '',
                'press_email' => $config['press_email'] ?? '',
                'management_email' => $config['management_email'] ?? '',
                'website' => $config['website'] ?? '',
                // Only surface phone/address at all if the artist opted in —
                // enforced here, not left to the frontend to respect.
                'phone' => ($config['show_phone'] ?? false) ? ($config['phone'] ?? '') : '',
                'address' => ($config['show_address'] ?? false) ? ($config['address'] ?? '') : '',
            ],
            SectionType::Downloads => [
                'files' => collect($config['media_ids'] ?? [])
                    ->map(fn ($id) => $this->mediaFor(is_int($id) ? $id : null))
                    ->filter()
                    ->map(fn (Media $media) => [
                        'id' => $media->id,
                        'filename' => $media->original_filename,
                        // Routed through a downloadFile() endpoint rather
                        // than the plain storage URL, so it actually
                        // downloads (Content-Disposition: attachment)
                        // instead of the browser opening the PDF/image
                        // inline in a new tab.
                        'url' => $this->privateLink
                            ? route('private.download', ['token' => $this->privateLink->token, 'media' => $media->id])
                            : route('public.epk.download', ['slug' => $section->epk->slug, 'media' => $media->id]),
                        'size' => $media->size,
                        'mime_type' => $media->mime_type,
                    ])
                    ->values()
                    ->all(),
            ],
            SectionType::Credits => [
                'items' => $config['items'] ?? [],
            ],
            SectionType::Custom => [
                'heading' => $config['heading'] ?? '',
                'html' => $config['html'] ?? '',
            ],
            SectionType::Photos => [
                'items' => collect($config['items'] ?? [])
                    ->map(function ($item) {
                        $media = $this->mediaFor($item['media_id'] ?? null);
                        if (! $media) {
                            return null;
                        }

                        return [
                            'url' => $media->url(),
                            'thumbnail_url' => $media->thumbnailUrl() ?? $media->url(),
                            'caption' => $item['caption'] ?? '',
                            'credit' => $item['credit'] ?? '',
                        ];
                    })
                    ->filter()
                    ->values()
                    ->all(),
            ],
            SectionType::Music => [
                'tracks' => collect($config['tracks'] ?? [])
                    ->map(function ($track) {
                        $provider = $track['provider'] ?? 'upload';

                        if ($provider === 'upload') {
                            $media = $this->mediaFor($track['audio_media_id'] ?? null);
                            if (! $media) {
                                return null;
                            }

                            return [
                                'title' => $track['title'] ?: $media->original_filename,
                                'provider' => 'upload',
                                'audio_url' => $media->url(),
                                'mime_type' => $media->mime_type,
                            ];
                        }

                        $embedUrl = $this->embedUrlFor($provider, $track['url'] ?? null);
                        if (! $embedUrl) {
                            return null;
                        }

                        return ['title' => $track['title'] ?? '', 'provider' => $provider, 'embed_url' => $embedUrl];
                    })
                    ->filter()
                    ->values()
                    ->all(),
            ],
            SectionType::Releases => [
                'releases' => collect($config['releases'] ?? [])
                    ->map(fn ($release) => [
                        'title' => $release['title'] ?? '',
                        'type' => $release['type'] ?? 'album',
                        'release_date' => $release['release_date'] ?? null,
                        'cover_image_url' => $this->urlFor($release['cover_media_id'] ?? null),
                        'links' => array_filter([
                            'spotify' => $release['links']['spotify'] ?? null,
                            'apple_music' => $release['links']['apple_music'] ?? null,
                            'youtube' => $release['links']['youtube'] ?? null,
                            'soundcloud' => $release['links']['soundcloud'] ?? null,
                            'deezer' => $release['links']['deezer'] ?? null,
                            'bandcamp' => $release['links']['bandcamp'] ?? null,
                        ]),
                    ])
                    ->filter(fn ($release) => $release['title'] !== '')
                    ->values()
                    ->all(),
            ],
            SectionType::Videos => [
                'videos' => collect($config['videos'] ?? [])
                    ->map(function ($video) {
                        $provider = $video['provider'] ?? 'youtube';

                        if ($provider === 'upload') {
                            $media = $this->mediaFor($video['media_id'] ?? null);
                            if (! $media) {
                                return null;
                            }

                            return ['title' => $video['title'] ?? '', 'provider' => 'upload', 'video_url' => $media->url(), 'mime_type' => $media->mime_type];
                        }

                        $embedUrl = $this->embedUrlFor($provider, $video['url'] ?? null);
                        if (! $embedUrl) {
                            return null;
                        }

                        return ['title' => $video['title'] ?? '', 'provider' => $provider, 'embed_url' => $embedUrl];
                    })
                    ->filter()
                    ->values()
                    ->all(),
            ],
            SectionType::Press => [
                'items' => collect($config['items'] ?? [])
                    ->map(fn ($item) => [
                        'outlet' => $item['outlet'] ?? '',
                        'quote' => $item['quote'] ?? '',
                        'article_url' => $item['article_url'] ?? '',
                        'author' => $item['author'] ?? '',
                        'published_at' => $item['published_at'] ?? null,
                    ])
                    ->filter(fn ($item) => $item['outlet'] !== '')
                    ->values()
                    ->all(),
            ],
            // Events has no dedicated content yet.
            default => [],
        };
    }

    private function urlFor(?int $mediaId): ?string
    {
        return $this->mediaFor($mediaId)?->url();
    }

    /**
     * Converts a normal YouTube/Vimeo/Spotify/SoundCloud share URL into its
     * embeddable iframe-src form. Returns null for anything that doesn't
     * look like a valid URL for that provider, so a malformed/empty entry is
     * dropped rather than rendered as a broken iframe.
     */
    private function embedUrlFor(string $provider, ?string $url): ?string
    {
        if (! $url) {
            return null;
        }

        if ($provider === 'youtube') {
            if (preg_match('/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{6,})/', $url, $matches)) {
                return "https://www.youtube.com/embed/{$matches[1]}";
            }

            return null;
        }

        if ($provider === 'vimeo') {
            if (preg_match('/vimeo\.com\/(?:video\/)?(\d+)/', $url, $matches)) {
                return "https://player.vimeo.com/video/{$matches[1]}";
            }

            return null;
        }

        if ($provider === 'spotify') {
            if (preg_match('#open\.spotify\.com/(track|album|playlist|artist|episode|show)/([A-Za-z0-9]+)#', $url, $matches)) {
                return "https://open.spotify.com/embed/{$matches[1]}/{$matches[2]}";
            }

            return null;
        }

        if ($provider === 'soundcloud') {
            // SoundCloud's own embed player takes the *original* track/set
            // URL as a query param (there's no short numeric id to extract
            // the way Spotify/YouTube/Vimeo have) — restricted to
            // soundcloud.com hosts so this can't become an open redirect
            // into an arbitrary iframe src.
            if (preg_match('#^https://(?:www\.|on\.)?soundcloud\.com/[\w-]+(?:/[\w-]+)?/?(?:\?.*)?$#', $url)) {
                return 'https://w.soundcloud.com/player/?url='.rawurlencode($url).'&color=%23ff5500&auto_play=false&show_comments=false&visual=false';
            }

            return null;
        }

        return null;
    }

    private function mediaFor(?int $mediaId): ?Media
    {
        if (! $mediaId) {
            return null;
        }

        if (! array_key_exists($mediaId, $this->mediaCache)) {
            $this->mediaCache[$mediaId] = Media::find($mediaId);
        }

        return $this->mediaCache[$mediaId];
    }
}
