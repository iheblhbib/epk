<?php

use App\Enums\SectionType;
use App\Models\Artist;
use App\Models\Epk;
use App\Models\Media;
use App\Models\Workspace;
use Illuminate\Support\Facades\Storage;

function makePublishedEpk(array $attributes = []): Epk
{
    $workspace = Workspace::factory()->create();
    $artist = Artist::factory()->create(['workspace_id' => $workspace->id]);

    return Epk::factory()->published()->create([
        'workspace_id' => $workspace->id,
        'artist_id' => $artist->id,
        ...$attributes,
    ]);
}

it('serves a published epk by slug with no authentication', function () {
    $epk = makePublishedEpk(['title' => 'Midnight Echoes']);
    $epk->sections()->create([
        'type' => SectionType::Biography,
        'is_enabled' => true,
        'position' => 1,
        'config' => ['html' => '<p>Bio</p>'],
    ]);

    $response = $this->getJson("/api/public/epks/{$epk->slug}");

    $response->assertOk();
    $response->assertJsonPath('data.title', 'Midnight Echoes');
    $response->assertJsonPath('data.artist.name', $epk->artist->name);
    $response->assertJsonPath('data.sections.0.type', 'biography');
    $response->assertJsonPath('data.sections.0.config.html', '<p>Bio</p>');
});

it('exposes the theme preset and customizations', function () {
    $epk = makePublishedEpk(['theme' => 'dark', 'custom_settings' => ['accent_color' => '#00FFAA', 'font' => 'mono']]);

    $response = $this->getJson("/api/public/epks/{$epk->slug}");

    $response->assertOk();
    $response->assertJsonPath('data.theme', 'dark');
    $response->assertJsonPath('data.custom_settings.accent_color', '#00FFAA');
    $response->assertJsonPath('data.custom_settings.font', 'mono');
});

it('404s for a draft epk', function () {
    $epk = Epk::factory()->create();

    $this->getJson("/api/public/epks/{$epk->slug}")->assertNotFound();
});

it('404s for an archived epk', function () {
    $epk = Epk::factory()->archived()->create();

    $this->getJson("/api/public/epks/{$epk->slug}")->assertNotFound();
});

it('404s for an unknown slug', function () {
    $this->getJson('/api/public/epks/does-not-exist')->assertNotFound();
});

it('only returns enabled sections, in position order', function () {
    $epk = makePublishedEpk();
    $epk->sections()->create(['type' => SectionType::Credits, 'is_enabled' => true, 'position' => 2, 'config' => ['items' => []]]);
    $epk->sections()->create(['type' => SectionType::Biography, 'is_enabled' => false, 'position' => 1, 'config' => ['html' => 'hidden']]);
    $epk->sections()->create(['type' => SectionType::Custom, 'is_enabled' => true, 'position' => 0, 'config' => ['heading' => 'First', 'html' => '']]);

    $response = $this->getJson("/api/public/epks/{$epk->slug}");

    $response->assertOk();
    $types = $response->json('data.sections.*.type');
    expect($types)->toBe(['custom', 'credits']);
});

it('resolves hero media ids to public urls', function () {
    $epk = makePublishedEpk();
    $profile = Media::factory()->image()->create(['workspace_id' => $epk->workspace_id]);

    $epk->sections()->create([
        'type' => SectionType::Hero,
        'is_enabled' => true,
        'position' => 0,
        'config' => [
            'headline' => 'Hello',
            'profile_media_id' => $profile->id,
            'background_media_id' => null,
        ],
    ]);

    $response = $this->getJson("/api/public/epks/{$epk->slug}");

    $response->assertOk();
    $response->assertJsonPath('data.sections.0.config.profile_image_url', $profile->url());
    $response->assertJsonPath('data.sections.0.config.background_image_url', null);
});

it('resolves downloads media ids to file objects, routed through the download endpoint', function () {
    $epk = makePublishedEpk();
    $file = Media::factory()->create(['workspace_id' => $epk->workspace_id, 'original_filename' => 'presskit.pdf']);

    $epk->sections()->create([
        'type' => SectionType::Downloads,
        'is_enabled' => true,
        'position' => 0,
        'config' => ['media_ids' => [$file->id]],
    ]);

    $response = $this->getJson("/api/public/epks/{$epk->slug}");

    $response->assertOk();
    $response->assertJsonPath('data.sections.0.config.files.0.filename', 'presskit.pdf');
    // Not the plain storage URL — routed through downloadFile() so it
    // actually downloads instead of opening inline in a new tab.
    $response->assertJsonPath(
        'data.sections.0.config.files.0.url',
        route('public.epk.download', ['slug' => $epk->slug, 'media' => $file->id])
    );
});

it('streams a downloads-section file with a Content-Disposition header forcing a real download', function () {
    Storage::fake('public');
    $epk = makePublishedEpk();
    $media = Media::factory()->create([
        'workspace_id' => $epk->workspace_id,
        'disk' => 'public',
        'path' => 'workspaces/1/media/document/presskit.pdf',
        'original_filename' => 'presskit.pdf',
    ]);
    Storage::disk('public')->put($media->path, 'fake pdf bytes');

    $epk->sections()->create([
        'type' => SectionType::Downloads,
        'is_enabled' => true,
        'position' => 0,
        'config' => ['media_ids' => [$media->id]],
    ]);

    $response = $this->get(route('public.epk.download', ['slug' => $epk->slug, 'media' => $media->id]));

    $response->assertOk();
    $response->assertHeader('Content-Disposition');
    expect($response->headers->get('Content-Disposition'))->toContain('attachment');
    expect($response->headers->get('Content-Disposition'))->toContain('presskit.pdf');
});

it('404s downloading a media id that is not in an enabled downloads section on that epk', function () {
    $epk = makePublishedEpk();
    $unrelatedMedia = Media::factory()->create(['workspace_id' => $epk->workspace_id]);

    $this->get(route('public.epk.download', ['slug' => $epk->slug, 'media' => $unrelatedMedia->id]))
        ->assertNotFound();
});

it('404s downloading from a draft epk even with a real media id', function () {
    $draft = Epk::factory()->create();
    $media = Media::factory()->create(['workspace_id' => $draft->workspace_id]);
    $draft->sections()->create([
        'type' => SectionType::Downloads,
        'is_enabled' => true,
        'position' => 0,
        'config' => ['media_ids' => [$media->id]],
    ]);

    $this->get(route('public.epk.download', ['slug' => $draft->slug, 'media' => $media->id]))
        ->assertNotFound();
});

it('resolves a photo gallery, dropping entries whose media no longer exists', function () {
    $epk = makePublishedEpk();
    $photo = Media::factory()->image()->create(['workspace_id' => $epk->workspace_id]);

    $epk->sections()->create([
        'type' => SectionType::Photos,
        'is_enabled' => true,
        'position' => 0,
        'config' => ['items' => [
            ['media_id' => $photo->id, 'caption' => 'On stage', 'credit' => 'J. Doe'],
            ['media_id' => 999999, 'caption' => 'Missing', 'credit' => ''],
        ]],
    ]);

    $response = $this->getJson("/api/public/epks/{$epk->slug}");

    $response->assertOk();
    $items = $response->json('data.sections.0.config.items');
    expect($items)->toHaveCount(1);
    expect($items[0]['url'])->toBe($photo->url());
    expect($items[0]['caption'])->toBe('On stage');
});

it('resolves music tracks to audio urls, falling back to the filename when untitled', function () {
    $epk = makePublishedEpk();
    $audio = Media::factory()->create(['workspace_id' => $epk->workspace_id, 'original_filename' => 'live-take.mp3']);

    $epk->sections()->create([
        'type' => SectionType::Music,
        'is_enabled' => true,
        'position' => 0,
        'config' => ['tracks' => [['title' => '', 'audio_media_id' => $audio->id]]],
    ]);

    $response = $this->getJson("/api/public/epks/{$epk->slug}");

    $response->assertOk();
    $response->assertJsonPath('data.sections.0.config.tracks.0.title', 'live-take.mp3');
    $response->assertJsonPath('data.sections.0.config.tracks.0.audio_url', $audio->url());
});

it('resolves releases with a cover image and streaming links, dropping untitled entries', function () {
    $epk = makePublishedEpk();
    $cover = Media::factory()->image()->create(['workspace_id' => $epk->workspace_id]);

    $epk->sections()->create([
        'type' => SectionType::Releases,
        'is_enabled' => true,
        'position' => 0,
        'config' => ['releases' => [
            ['title' => 'Neon Dreams', 'type' => 'ep', 'cover_media_id' => $cover->id, 'links' => ['spotify' => 'https://open.spotify.com/x']],
            ['title' => '', 'type' => 'single'],
        ]],
    ]);

    $response = $this->getJson("/api/public/epks/{$epk->slug}");

    $response->assertOk();
    $releases = $response->json('data.sections.0.config.releases');
    expect($releases)->toHaveCount(1);
    expect($releases[0]['cover_image_url'])->toBe($cover->url());
    expect($releases[0]['links'])->toBe(['spotify' => 'https://open.spotify.com/x']);
});

it('converts youtube/vimeo urls to embed urls and resolves uploaded videos', function () {
    $epk = makePublishedEpk();
    $upload = Media::factory()->create(['workspace_id' => $epk->workspace_id]);

    $epk->sections()->create([
        'type' => SectionType::Videos,
        'is_enabled' => true,
        'position' => 0,
        'config' => ['videos' => [
            ['title' => 'Live at the Fillmore', 'provider' => 'youtube', 'url' => 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'],
            ['title' => 'Studio session', 'provider' => 'vimeo', 'url' => 'https://vimeo.com/123456789'],
            ['title' => 'Behind the scenes', 'provider' => 'upload', 'media_id' => $upload->id],
            ['title' => 'Broken link', 'provider' => 'youtube', 'url' => 'not-a-url'],
        ]],
    ]);

    $response = $this->getJson("/api/public/epks/{$epk->slug}");

    $response->assertOk();
    $videos = $response->json('data.sections.0.config.videos');
    expect($videos)->toHaveCount(3);
    expect($videos[0]['embed_url'])->toBe('https://www.youtube.com/embed/dQw4w9WgXcQ');
    expect($videos[1]['embed_url'])->toBe('https://player.vimeo.com/video/123456789');
    expect($videos[2]['video_url'])->toBe($upload->url());
});

it('resolves press coverage, dropping entries without an outlet', function () {
    $epk = makePublishedEpk();

    $epk->sections()->create([
        'type' => SectionType::Press,
        'is_enabled' => true,
        'position' => 0,
        'config' => ['items' => [
            ['outlet' => 'Pitchfork', 'quote' => 'A stunning debut.', 'article_url' => 'https://pitchfork.example/review', 'author' => 'A. Writer'],
            ['outlet' => '', 'quote' => 'Should be dropped'],
        ]],
    ]);

    $response = $this->getJson("/api/public/epks/{$epk->slug}");

    $response->assertOk();
    $items = $response->json('data.sections.0.config.items');
    expect($items)->toHaveCount(1);
    expect($items[0]['outlet'])->toBe('Pitchfork');
    expect($items[0]['quote'])->toBe('A stunning debut.');
});

it('hides phone and address on the contact section unless explicitly shown', function () {
    $epk = makePublishedEpk();

    $epk->sections()->create([
        'type' => SectionType::Contact,
        'is_enabled' => true,
        'position' => 0,
        'config' => [
            'phone' => '+1 555 0100',
            'address' => '123 Main St',
            'show_phone' => false,
            'show_address' => true,
        ],
    ]);

    $response = $this->getJson("/api/public/epks/{$epk->slug}");

    $response->assertOk();
    $response->assertJsonPath('data.sections.0.config.phone', '');
    $response->assertJsonPath('data.sections.0.config.address', '123 Main St');
});
