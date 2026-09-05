<?php

namespace App\Services;

use App\Enums\SectionType;
use App\Models\Epk;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Mpdf\Mpdf;
use Mpdf\Output\Destination;

/**
 * Renders an EPK to a downloadable one-pager PDF — the classic "press kit
 * attachment" format labels/journalists still expect, alongside the public
 * web page. Pure-PHP (mPDF, not a headless-Chrome/Puppeteer route) so this
 * works on plain cPanel shared hosting with no Node runtime — see
 * docs/cpanel-deployment.md for why that constraint exists at all.
 *
 * Deliberately its own clean print stylesheet rather than the EPK's own
 * on-screen theme colors: a theme tuned for a dark hero banner on a monitor
 * often prints badly (wasted ink, poor contrast on paper), and a press kit
 * PDF is conventionally plain and readable regardless of the web page's
 * branding. Downloads and video sections are skipped — a "here are more
 * files to download" link inside a PDF someone already downloaded isn't
 * useful there, and a video can't actually play on paper. The Music
 * section is the one exception: since the PDF can't embed audio either,
 * it links out to the same "download the discography as a zip" endpoint
 * the web page uses, gated to published EPKs in the template itself (see
 * pdf.epk's Music case) since that endpoint 404s otherwise.
 */
class EpkPdfService
{
    public function __construct(private readonly PublicSectionConfigResolver $resolver) {}

    public function render(Epk $epk): string
    {
        $mpdf = new Mpdf([
            'format' => 'A4',
            'margin_top' => 20,
            'margin_bottom' => 18,
            'margin_left' => 18,
            'margin_right' => 18,
            'tempDir' => storage_path('app/mpdf-tmp'),
            'curlAllowUnsafeSslLocal' => true,
        ]);

        $mpdf->SetTitle($epk->seo_title ?: $epk->title);
        $mpdf->WriteHTML($this->buildHtml($epk));

        return $mpdf->Output('', Destination::STRING_RETURN);
    }

    /**
     * Split out from render() so the image-inlining below is directly
     * testable against the generated HTML — mPDF's own PDF output is
     * compressed, so a test can't just search it for a marker string.
     */
    public function buildHtml(Epk $epk): string
    {
        $epk->loadMissing(['artist', 'sections' => fn ($query) => $query->where('is_enabled', true)->orderBy('position')]);

        $sections = $epk->sections
            ->reject(fn ($section) => in_array($section->type, [SectionType::Downloads, SectionType::Videos], true))
            ->map(fn ($section) => [
                'type' => $section->type,
                'title' => $section->title ?: $section->type->label(),
                'config' => $this->inlineImages($section->type, $this->resolver->resolve($section)),
            ]);

        return view('pdf.epk', [
            'epk' => $epk,
            'artist' => $epk->artist,
            'sections' => $sections,
        ])->render();
    }

    /**
     * mPDF fetches any http(s) <img src> over a real HTTP connection, even
     * one pointing back at this same server. On a single-worker dev server
     * (php artisan serve's default) that self-fetch can never complete,
     * since the one worker is already busy handling this very request — it
     * hangs indefinitely rather than erroring. Reading each image's bytes
     * directly off the 'public' disk and inlining them as data: URIs avoids
     * that request entirely, in dev and production alike.
     *
     * @return array<string, mixed>
     */
    private function inlineImages(SectionType $type, array $config): array
    {
        return match ($type) {
            SectionType::Hero => [
                ...$config,
                'profile_image_url' => $this->inlineImage($config['profile_image_url'] ?? null),
                'background_image_url' => $this->inlineImage($config['background_image_url'] ?? null),
            ],
            SectionType::Photos => [
                ...$config,
                'items' => collect($config['items'] ?? [])->map(fn ($item) => [
                    ...$item,
                    'url' => $this->inlineImage($item['url'] ?? null),
                    'thumbnail_url' => $this->inlineImage($item['thumbnail_url'] ?? null),
                ])->all(),
            ],
            SectionType::Releases => [
                ...$config,
                'releases' => collect($config['releases'] ?? [])->map(fn ($release) => [
                    ...$release,
                    'cover_image_url' => $this->inlineImage($release['cover_image_url'] ?? null),
                ])->all(),
            ],
            default => $config,
        };
    }

    private function inlineImage(?string $url): ?string
    {
        if (! $url) {
            return $url;
        }

        $disk = Storage::disk('public');
        $path = Str::after($url, $disk->url(''));

        if (! $disk->exists($path)) {
            return $url;
        }

        $mimeType = $disk->mimeType($path) ?: 'application/octet-stream';

        return 'data:'.$mimeType.';base64,'.base64_encode($disk->get($path));
    }
}
