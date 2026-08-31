<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Epk;
use App\Services\EpkPdfService;
use Illuminate\Http\Response;
use Illuminate\Support\Str;

class EpkPdfController extends Controller
{
    /**
     * Authenticated download from the builder — any workspace member (same
     * ability as viewing the EPK at all), regardless of publish status, so
     * a draft can still be reviewed as a PDF before going live.
     */
    public function download(Epk $epk, EpkPdfService $pdf): Response
    {
        $this->authorize('view', $epk);

        return $this->respondWithPdf($pdf->render($epk), $epk->title);
    }

    /**
     * Public download from the published web page — scoped to `published`
     * exactly like PublicEpkController::show(), so a draft/archived EPK's
     * PDF isn't reachable just by knowing its slug.
     */
    public function downloadPublic(string $slug, EpkPdfService $pdf): Response
    {
        $epk = Epk::query()->published()->where('slug', $slug)->firstOrFail();

        return $this->respondWithPdf($pdf->render($epk), $epk->title);
    }

    private function respondWithPdf(string $contents, string $title): Response
    {
        $filename = Str::slug($title).'-epk.pdf';

        return response($contents, 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => "attachment; filename=\"{$filename}\"",
        ]);
    }
}
