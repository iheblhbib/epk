<?php

use App\Enums\SectionType;
use App\Enums\WorkspaceRole;
use App\Models\Artist;
use App\Models\Epk;
use App\Models\Media;
use App\Models\User;
use App\Models\Workspace;
use App\Services\EpkPdfService;
use Illuminate\Support\Facades\Storage;

function makeEpkForPdf(bool $published = false): Epk
{
    $workspace = Workspace::factory()->create();
    $artist = Artist::factory()->create(['workspace_id' => $workspace->id, 'name' => 'Nova Ray']);

    $factory = Epk::factory();
    if ($published) {
        $factory = $factory->published();
    }

    $epk = $factory->create([
        'workspace_id' => $workspace->id,
        'artist_id' => $artist->id,
        'title' => 'Nova Ray EPK',
    ]);

    $epk->sections()->create([
        'type' => SectionType::Hero,
        'is_enabled' => true,
        'position' => 1,
        'config' => ['headline' => 'Nova Ray', 'subtitle' => 'Synthwave from Marseille'],
    ]);
    $epk->sections()->create([
        'type' => SectionType::Biography,
        'is_enabled' => true,
        'position' => 2,
        'config' => ['html' => '<p>Nova Ray makes music at night.</p>'],
    ]);
    $epk->sections()->create([
        'type' => SectionType::Press,
        'is_enabled' => true,
        'position' => 3,
        'config' => ['items' => [['outlet' => 'Synth Weekly', 'quote' => 'Genuinely great.', 'author' => 'J. Doe']]],
    ]);

    return $epk;
}

it('lets a workspace member download a PDF for a draft EPK', function () {
    $epk = makeEpkForPdf();
    $owner = User::factory()->create();
    $epk->workspace->members()->create(['user_id' => $owner->id, 'role' => WorkspaceRole::Owner, 'status' => 'active', 'joined_at' => now()]);

    $response = $this->actingAs($owner)->get("/api/epks/{$epk->id}/pdf");

    $response->assertOk();
    $response->assertHeader('Content-Type', 'application/pdf');
    expect(substr($response->getContent(), 0, 4))->toBe('%PDF');
});

it('refuses a PDF download to someone outside the workspace', function () {
    $epk = makeEpkForPdf();
    $stranger = User::factory()->create();

    $this->actingAs($stranger)->get("/api/epks/{$epk->id}/pdf")->assertForbidden();
});

it('serves a public PDF for a published EPK with no authentication', function () {
    $epk = makeEpkForPdf(published: true);

    $response = $this->get("/api/public/epks/{$epk->slug}/pdf");

    $response->assertOk();
    $response->assertHeader('Content-Type', 'application/pdf');
    expect(substr($response->getContent(), 0, 4))->toBe('%PDF');
});

it('404s the public PDF route for an unpublished EPK', function () {
    $epk = makeEpkForPdf();

    $this->get("/api/public/epks/{$epk->slug}/pdf")->assertNotFound();
});

it('includes a link to download all music as a zip when the section has one', function () {
    $epk = Epk::factory()->published()->make(['title' => 'Nova Ray EPK']);
    $artist = Artist::factory()->make(['name' => 'Nova Ray']);

    $html = view('pdf.epk', [
        'epk' => $epk,
        'artist' => $artist,
        'sections' => collect([
            [
                'type' => SectionType::Music,
                'title' => 'Music',
                'config' => [
                    'tracks' => [['title' => 'Night Drive', 'provider' => 'upload']],
                    'download_all_url' => 'https://example.test/music/download-all',
                ],
            ],
        ]),
    ])->render();

    expect($html)->toContain('https://example.test/music/download-all');
});

it('omits the download-all link for a draft EPK\'s pdf, even if the resolved config has one', function () {
    // The link is always resolved through the public route (EpkPdfService
    // never scopes it to a private link), which 404s for a non-published
    // EPK -- so an owner previewing a draft's PDF shouldn't get a link
    // that's guaranteed to be broken until they publish.
    $epk = Epk::factory()->make(['title' => 'Nova Ray EPK']);
    $artist = Artist::factory()->make(['name' => 'Nova Ray']);

    $html = view('pdf.epk', [
        'epk' => $epk,
        'artist' => $artist,
        'sections' => collect([
            [
                'type' => SectionType::Music,
                'title' => 'Music',
                'config' => [
                    'tracks' => [['title' => 'Night Drive', 'provider' => 'upload']],
                    'download_all_url' => 'https://example.test/music/download-all',
                ],
            ],
        ]),
    ])->render();

    expect($html)->not->toContain('https://example.test/music/download-all');
});

it('keeps the music download-all link recognizable as an external URL to mPDF, even on a dotless dev host', function () {
    // mPDF's own HTML-to-PDF link resolver (Mpdf.php: "assuming every
    // external link has a dot indicating extension") treats any <a href>
    // with no literal "." anywhere in it as an internal document anchor
    // instead of an external URL -- silently turning "Download the
    // discography as a ZIP" into a dead link that just jumps to page 1.
    // A real production domain always has a dot (e.g. api.koraxx.app), so
    // this never surfaces there, but a local dev URL like
    // "http://localhost:8000/api/public/epks/nova-ray/music/download-all"
    // has none at all, which is exactly the environment this link most
    // needs to work in.
    $epk = Epk::factory()->published()->make(['title' => 'Nova Ray EPK']);
    $artist = Artist::factory()->make(['name' => 'Nova Ray']);
    $dotlessUrl = 'http://localhost:8000/api/public/epks/nova-ray/music/download-all';

    $html = view('pdf.epk', [
        'epk' => $epk,
        'artist' => $artist,
        'sections' => collect([
            [
                'type' => SectionType::Music,
                'title' => 'Music',
                'config' => [
                    'tracks' => [['title' => 'Night Drive', 'provider' => 'upload']],
                    'download_all_url' => $dotlessUrl,
                ],
            ],
        ]),
    ])->render();

    preg_match('/<a href="([^"]+)">Download the discography as a ZIP<\/a>/', $html, $matches);
    expect($matches)->toHaveCount(2);
    [, $renderedHref] = $matches;

    // A browser strips everything from "#" onward before sending the
    // request, so the actual endpoint hit must be unchanged...
    expect(strtok($renderedHref, '#'))->toBe($dotlessUrl);
    // ...while the full string mPDF sees must contain a literal "." so its
    // dot-heuristic classifies it as external, not an internal anchor.
    expect($renderedHref)->toContain('.');
});

it('embeds a hero image as a base64 data URI instead of a self-referential HTTP url', function () {
    // mPDF fetches any http(s) <img src> over a real HTTP connection, even
    // one pointing back at this same server -- on a single-worker dev server
    // (php artisan serve's default) that self-fetch can never complete,
    // since the one worker is already busy handling this very request. It
    // hangs indefinitely instead of erroring. Embedding the image's actual
    // bytes as a data: URI up front means mPDF never makes that request.
    Storage::fake('public');
    $workspace = Workspace::factory()->create();
    $artist = Artist::factory()->create(['workspace_id' => $workspace->id, 'name' => 'Nova Ray']);
    $epk = Epk::factory()->published()->create([
        'workspace_id' => $workspace->id,
        'artist_id' => $artist->id,
        'title' => 'Nova Ray EPK',
    ]);
    $media = Media::factory()->create([
        'workspace_id' => $workspace->id,
        'disk' => 'public',
        'path' => 'workspaces/1/media/image/hero.webp',
        'type' => 'image',
    ]);
    Storage::disk('public')->put($media->path, 'fake webp bytes');

    $epk->sections()->create([
        'type' => SectionType::Hero,
        'is_enabled' => true,
        'position' => 0,
        'config' => ['headline' => 'Nova Ray', 'profile_media_id' => $media->id],
    ]);

    $html = app(EpkPdfService::class)->buildHtml($epk);

    expect($html)->toContain('data:');
    expect($html)->not->toContain('http://');
    expect($html)->not->toContain('https://');
});

it('renders fine for an EPK with no hero section, an unheaded custom section, and a link missing its platform', function () {
    // Regression test: found live (not by any prior automated test, whose
    // fixture always included a fully-populated Hero section) — a bare
    // array-key access followed by `?:` throws on a missing key instead of
    // falling through, for any of these three gaps.
    $workspace = Workspace::factory()->create();
    $artist = Artist::factory()->create(['workspace_id' => $workspace->id, 'name' => 'Nova Ray']);
    $epk = Epk::factory()->published()->create([
        'workspace_id' => $workspace->id,
        'artist_id' => $artist->id,
        'title' => 'Nova Ray EPK',
    ]);

    $epk->sections()->create([
        'type' => SectionType::Custom,
        'is_enabled' => true,
        'position' => 1,
        'config' => ['html' => '<p>Some custom copy, no heading set.</p>'],
    ]);
    $epk->sections()->create([
        'type' => SectionType::SocialNetworks,
        'is_enabled' => true,
        'position' => 2,
        'config' => ['links' => [['url' => 'https://example.com/novaray']]],
    ]);

    $response = $this->get("/api/public/epks/{$epk->slug}/pdf");

    $response->assertOk();
    expect(substr($response->getContent(), 0, 4))->toBe('%PDF');
});
