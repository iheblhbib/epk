<?php

namespace App\Services;

use App\Enums\SectionType;
use App\Models\Epk;
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
 * branding. Downloads and uploaded-video sections are skipped — a "here are
 * more files to download" link inside a PDF someone already downloaded, or
 * a video that can't actually play on paper, isn't useful there.
 */
class EpkPdfService
{
    public function __construct(private readonly PublicSectionConfigResolver $resolver) {}

    public function render(Epk $epk): string
    {
        $epk->loadMissing(['artist', 'sections' => fn ($query) => $query->where('is_enabled', true)->orderBy('position')]);

        $sections = $epk->sections
            ->reject(fn ($section) => in_array($section->type, [SectionType::Downloads, SectionType::Videos], true))
            ->map(fn ($section) => [
                'type' => $section->type,
                'title' => $section->title ?: $section->type->label(),
                'config' => $this->resolver->resolve($section),
            ]);

        $html = view('pdf.epk', [
            'epk' => $epk,
            'artist' => $epk->artist,
            'sections' => $sections,
        ])->render();

        // Images in the view are the same storage/ URLs the public web page
        // uses (from PublicSectionConfigResolver) — mPDF fetches them over
        // HTTP, which needs allow_url_fopen enabled (on by default on
        // virtually every host, cPanel included) since this is a
        // self-referential request back to this same server.
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
        $mpdf->WriteHTML($html);

        return $mpdf->Output('', Destination::STRING_RETURN);
    }
}
