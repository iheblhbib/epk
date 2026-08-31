<?php

namespace App\Http\Controllers;

use App\Models\Epk;
use Illuminate\Contracts\View\View;

/**
 * A server-rendered "unfurl" page for one published EPK — the link meant to
 * be pasted into Slack/Twitter/Facebook/Discord/WhatsApp, never the one a
 * person actually browses. The SPA's own public EPK page only sets
 * document.title and a <meta name="description"> from client-side
 * JavaScript (see PublicEpkPage.tsx), which is invisible to a crawler that
 * never executes it — those bots only ever see whatever HTML this route
 * returns. This route's entire job is to carry real Open Graph/Twitter Card
 * <meta> tags, then bounce an actual browser straight through to the real
 * React page at FRONTEND_URL.
 */
class PublicEpkShareController extends Controller
{
    public function show(string $slug): View
    {
        $epk = Epk::published()->where('slug', $slug)->with('artist')->firstOrFail();

        $frontendUrl = rtrim((string) config('app.frontend_url'), '/');
        $redirectUrl = "{$frontendUrl}/epk/{$epk->slug}";

        $title = $epk->seo_title ?: $epk->title;
        $description = $epk->seo_description
            ?: ($epk->artist?->short_bio ?: __('Check out this press kit on KORAX.'));

        $imagePath = $epk->cover_image_path ?: $epk->artist?->profile_image_path;
        $image = $imagePath ? asset('storage/'.$imagePath) : null;

        return view('epk-share', [
            'title' => $title,
            'description' => $description,
            'image' => $image,
            'redirectUrl' => $redirectUrl,
        ]);
    }
}
