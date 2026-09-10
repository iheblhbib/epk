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

it('resolves a legacy plain-string hero height/alignment as fully inherited from desktop', function () {
    $epk = makePublishedEpk();
    $epk->sections()->create([
        'type' => SectionType::Hero,
        'is_enabled' => true,
        'position' => 0,
        'config' => ['headline' => 'Test', 'height' => 'small', 'alignment' => 'left'],
    ]);

    $response = $this->getJson("/api/public/epks/{$epk->slug}");

    $response->assertOk();
    $response->assertJsonPath('data.sections.0.config.height', ['desktop' => 'small', 'tablet' => 'small', 'mobile' => 'small']);
    $response->assertJsonPath('data.sections.0.config.alignment', ['desktop' => 'left', 'tablet' => 'left', 'mobile' => 'left']);
});

it('lets a hero section\'s mobile height inherit from tablet, not desktop, when only mobile is unset', function () {
    $epk = makePublishedEpk();
    $epk->sections()->create([
        'type' => SectionType::Hero,
        'is_enabled' => true,
        'position' => 0,
        'config' => ['headline' => 'Test', 'height' => ['desktop' => 'large', 'tablet' => 'medium']],
    ]);

    $response = $this->getJson("/api/public/epks/{$epk->slug}");

    $response->assertOk();
    $response->assertJsonPath('data.sections.0.config.height', ['desktop' => 'large', 'tablet' => 'medium', 'mobile' => 'medium']);
});

it('keeps every explicit per-device hero height/alignment value when all three are set', function () {
    $epk = makePublishedEpk();
    $epk->sections()->create([
        'type' => SectionType::Hero,
        'is_enabled' => true,
        'position' => 0,
        'config' => [
            'headline' => 'Test',
            'height' => ['desktop' => 'large', 'tablet' => 'medium', 'mobile' => 'small'],
            'alignment' => ['desktop' => 'center', 'tablet' => 'left', 'mobile' => 'right'],
        ],
    ]);

    $response = $this->getJson("/api/public/epks/{$epk->slug}");

    $response->assertOk();
    $response->assertJsonPath('data.sections.0.config.height', ['desktop' => 'large', 'tablet' => 'medium', 'mobile' => 'small']);
    $response->assertJsonPath('data.sections.0.config.alignment', ['desktop' => 'center', 'tablet' => 'left', 'mobile' => 'right']);
});

it('treats an explicit null hero tablet height the same as an absent tablet key', function () {
    $epk = makePublishedEpk();
    $epk->sections()->create([
        'type' => SectionType::Hero,
        'is_enabled' => true,
        'position' => 0,
        'config' => ['headline' => 'Test', 'height' => ['desktop' => 'large', 'tablet' => null, 'mobile' => 'small']],
    ]);

    $response = $this->getJson("/api/public/epks/{$epk->slug}");

    $response->assertOk();
    $response->assertJsonPath('data.sections.0.config.height', ['desktop' => 'large', 'tablet' => 'large', 'mobile' => 'small']);
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

it('streams a music track file with a Content-Disposition header, not just downloads-section files', function () {
    Storage::fake('public');
    $epk = makePublishedEpk();
    $media = Media::factory()->create([
        'workspace_id' => $epk->workspace_id,
        'disk' => 'public',
        'path' => 'workspaces/1/media/audio/live-take.mp3',
        'original_filename' => 'live-take.mp3',
    ]);
    Storage::disk('public')->put($media->path, 'fake mp3 bytes');

    $epk->sections()->create([
        'type' => SectionType::Music,
        'is_enabled' => true,
        'position' => 0,
        'config' => ['tracks' => [['title' => 'Live Take', 'provider' => 'upload', 'audio_media_id' => $media->id]]],
    ]);

    $response = $this->get(route('public.epk.download', ['slug' => $epk->slug, 'media' => $media->id]));

    $response->assertOk();
    expect($response->headers->get('Content-Disposition'))->toContain('attachment');
    expect($response->headers->get('Content-Disposition'))->toContain('live-take.mp3');
});

it('downloads all uploaded music tracks as a single zip named after the EPK, not the slug', function () {
    Storage::fake('public');
    $epk = makePublishedEpk(['title' => 'Nova Ray EPK']);
    $trackOne = Media::factory()->create([
        'workspace_id' => $epk->workspace_id, 'disk' => 'public',
        'path' => 'workspaces/1/media/audio/one.mp3', 'original_filename' => 'one.mp3',
    ]);
    $trackTwo = Media::factory()->create([
        'workspace_id' => $epk->workspace_id, 'disk' => 'public',
        'path' => 'workspaces/1/media/audio/two.mp3', 'original_filename' => 'two.mp3',
    ]);
    Storage::disk('public')->put($trackOne->path, 'fake bytes one');
    Storage::disk('public')->put($trackTwo->path, 'fake bytes two');

    $epk->sections()->create([
        'type' => SectionType::Music,
        'is_enabled' => true,
        'position' => 0,
        'config' => ['tracks' => [
            ['title' => 'One', 'provider' => 'upload', 'audio_media_id' => $trackOne->id],
            ['title' => 'Two', 'provider' => 'upload', 'audio_media_id' => $trackTwo->id],
            ['title' => 'On Spotify', 'provider' => 'spotify', 'url' => 'https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC'],
        ]],
    ]);

    $response = $this->get(route('public.epk.music.download-all', ['slug' => $epk->slug]));

    $response->assertOk();
    expect($response->headers->get('Content-Type'))->toBe('application/zip');
    expect($response->headers->get('Content-Disposition'))->toContain('attachment');
    expect($response->headers->get('Content-Disposition'))->toContain('nova-ray-epk-music.zip');

    $zipPath = storage_path('framework/testing/downloaded.zip');
    file_put_contents($zipPath, $response->streamedContent());
    $zip = new ZipArchive;
    $zip->open($zipPath);
    expect($zip->numFiles)->toBe(2);
    expect($zip->getNameIndex(0))->toBe('one.mp3');
    expect($zip->getNameIndex(1))->toBe('two.mp3');
    $zip->close();
    unlink($zipPath);
});

it('disambiguates two tracks that share the same original filename inside the zip', function () {
    Storage::fake('public');
    $epk = makePublishedEpk();
    $trackOne = Media::factory()->create([
        'workspace_id' => $epk->workspace_id, 'disk' => 'public',
        'path' => 'workspaces/1/media/audio/one.mp3', 'original_filename' => 'take.mp3',
    ]);
    $trackTwo = Media::factory()->create([
        'workspace_id' => $epk->workspace_id, 'disk' => 'public',
        'path' => 'workspaces/1/media/audio/two.mp3', 'original_filename' => 'take.mp3',
    ]);
    Storage::disk('public')->put($trackOne->path, 'fake bytes one');
    Storage::disk('public')->put($trackTwo->path, 'fake bytes two');

    $epk->sections()->create([
        'type' => SectionType::Music,
        'is_enabled' => true,
        'position' => 0,
        'config' => ['tracks' => [
            ['title' => 'One', 'provider' => 'upload', 'audio_media_id' => $trackOne->id],
            ['title' => 'Two', 'provider' => 'upload', 'audio_media_id' => $trackTwo->id],
        ]],
    ]);

    $response = $this->get(route('public.epk.music.download-all', ['slug' => $epk->slug]));

    $zipPath = storage_path('framework/testing/downloaded-dupes.zip');
    file_put_contents($zipPath, $response->streamedContent());
    $zip = new ZipArchive;
    $zip->open($zipPath);
    expect($zip->numFiles)->toBe(2);
    expect($zip->getNameIndex(0))->toBe('take.mp3');
    expect($zip->getNameIndex(1))->toBe('take (2).mp3');
    $zip->close();
    unlink($zipPath);
});

it('404s the download-all endpoint when the epk has no uploaded music tracks', function () {
    $epk = makePublishedEpk();

    $this->get(route('public.epk.music.download-all', ['slug' => $epk->slug]))->assertNotFound();
});

it('downloads all files in a downloads section as a single zip named after the EPK, not the slug', function () {
    Storage::fake('public');
    $epk = makePublishedEpk(['title' => 'Nova Ray EPK']);
    $fileOne = Media::factory()->create([
        'workspace_id' => $epk->workspace_id, 'disk' => 'public',
        'path' => 'workspaces/1/media/document/one.pdf', 'original_filename' => 'one.pdf',
    ]);
    $fileTwo = Media::factory()->create([
        'workspace_id' => $epk->workspace_id, 'disk' => 'public',
        'path' => 'workspaces/1/media/document/two.pdf', 'original_filename' => 'two.pdf',
    ]);
    Storage::disk('public')->put($fileOne->path, 'fake bytes one');
    Storage::disk('public')->put($fileTwo->path, 'fake bytes two');

    $epk->sections()->create([
        'type' => SectionType::Downloads,
        'is_enabled' => true,
        'position' => 0,
        'config' => ['media_ids' => [$fileOne->id, $fileTwo->id]],
    ]);

    $response = $this->get(route('public.epk.downloads.download-all', ['slug' => $epk->slug]));

    $response->assertOk();
    expect($response->headers->get('Content-Type'))->toBe('application/zip');
    expect($response->headers->get('Content-Disposition'))->toContain('attachment');
    expect($response->headers->get('Content-Disposition'))->toContain('nova-ray-epk-files.zip');

    $zipPath = storage_path('framework/testing/downloaded-files.zip');
    file_put_contents($zipPath, $response->streamedContent());
    $zip = new ZipArchive;
    $zip->open($zipPath);
    expect($zip->numFiles)->toBe(2);
    expect($zip->getNameIndex(0))->toBe('one.pdf');
    expect($zip->getNameIndex(1))->toBe('two.pdf');
    $zip->close();
    unlink($zipPath);
});

it('404s the downloads-section download-all endpoint when the epk has no downloadable files', function () {
    $epk = makePublishedEpk();

    $this->get(route('public.epk.downloads.download-all', ['slug' => $epk->slug]))->assertNotFound();
});

it('exposes a section-level download-all-as-zip url when the downloads section has files', function () {
    Storage::fake('public');
    $epk = makePublishedEpk();
    $media = Media::factory()->create(['workspace_id' => $epk->workspace_id]);

    $epk->sections()->create([
        'type' => SectionType::Downloads,
        'is_enabled' => true,
        'position' => 0,
        'config' => ['media_ids' => [$media->id]],
    ]);

    $response = $this->getJson("/api/public/epks/{$epk->slug}");

    $response->assertOk();
    $response->assertJsonPath(
        'data.sections.0.config.download_all_url',
        route('public.epk.downloads.download-all', ['slug' => $epk->slug])
    );
});

it('omits the download-all url when the downloads section has no files', function () {
    $epk = makePublishedEpk();

    $epk->sections()->create([
        'type' => SectionType::Downloads,
        'is_enabled' => true,
        'position' => 0,
        'config' => ['media_ids' => []],
    ]);

    $response = $this->getJson("/api/public/epks/{$epk->slug}");

    $response->assertOk();
    expect($response->json('data.sections.0.config'))->not->toHaveKey('download_all_url');
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

it('resolves a custom social link\'s uploaded icon to a url, alongside a fixed-platform link', function () {
    $epk = makePublishedEpk();
    $icon = Media::factory()->image()->create(['workspace_id' => $epk->workspace_id]);

    $epk->sections()->create([
        'type' => SectionType::SocialNetworks,
        'is_enabled' => true,
        'position' => 0,
        'config' => ['links' => [
            ['platform' => 'instagram', 'url' => 'https://instagram.com/novaray'],
            ['platform' => 'custom', 'url' => 'https://linktr.ee/novaray', 'label' => 'Linktree', 'icon_media_id' => $icon->id],
        ]],
    ]);

    $response = $this->getJson("/api/public/epks/{$epk->slug}");

    $response->assertOk();
    $links = $response->json('data.sections.0.config.links');
    expect($links)->toHaveCount(2);
    expect($links[0])->toMatchArray(['platform' => 'instagram', 'url' => 'https://instagram.com/novaray', 'label' => '']);
    expect($links[0]['icon_url'])->toBeNull();
    expect($links[1])->toMatchArray(['platform' => 'custom', 'url' => 'https://linktr.ee/novaray', 'label' => 'Linktree']);
    expect($links[1]['icon_url'])->toBe($icon->url());
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

it('resolves optional lyrics on a music track, for both an uploaded and an embedded track', function () {
    $epk = makePublishedEpk();
    $audio = Media::factory()->create(['workspace_id' => $epk->workspace_id, 'original_filename' => 'live-take.mp3']);

    $epk->sections()->create([
        'type' => SectionType::Music,
        'is_enabled' => true,
        'position' => 0,
        'config' => ['tracks' => [
            ['title' => 'Live Take', 'provider' => 'upload', 'audio_media_id' => $audio->id, 'lyrics' => "Verse one\nVerse two"],
            ['title' => 'On Spotify', 'provider' => 'spotify', 'url' => 'https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC', 'lyrics' => 'Embedded lyrics'],
        ]],
    ]);

    $response = $this->getJson("/api/public/epks/{$epk->slug}");

    $response->assertOk();
    $response->assertJsonPath('data.sections.0.config.tracks.0.lyrics', "Verse one\nVerse two");
    $response->assertJsonPath('data.sections.0.config.tracks.1.lyrics', 'Embedded lyrics');
});

it('exposes a download url, filename, and size for uploaded music tracks, routed through the download endpoint', function () {
    $epk = makePublishedEpk();
    $audio = Media::factory()->create([
        'workspace_id' => $epk->workspace_id,
        'original_filename' => 'live-take.mp3',
        'size' => 4_200_000,
    ]);

    $epk->sections()->create([
        'type' => SectionType::Music,
        'is_enabled' => true,
        'position' => 0,
        'config' => ['tracks' => [['title' => 'Live Take', 'provider' => 'upload', 'audio_media_id' => $audio->id]]],
    ]);

    $response = $this->getJson("/api/public/epks/{$epk->slug}");

    $response->assertOk();
    // Not the plain storage URL -- routed through downloadFile() so it
    // actually downloads instead of opening inline, same as Downloads-section
    // files.
    $response->assertJsonPath(
        'data.sections.0.config.tracks.0.download_url',
        route('public.epk.download', ['slug' => $epk->slug, 'media' => $audio->id])
    );
    $response->assertJsonPath('data.sections.0.config.tracks.0.filename', 'live-take.mp3');
    $response->assertJsonPath('data.sections.0.config.tracks.0.size', 4_200_000);
});

it('does not expose a download url for embedded (spotify/soundcloud) tracks', function () {
    $epk = makePublishedEpk();

    $epk->sections()->create([
        'type' => SectionType::Music,
        'is_enabled' => true,
        'position' => 0,
        'config' => ['tracks' => [
            ['title' => 'On Spotify', 'provider' => 'spotify', 'url' => 'https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC'],
        ]],
    ]);

    $response = $this->getJson("/api/public/epks/{$epk->slug}");

    $response->assertOk();
    expect($response->json('data.sections.0.config.tracks.0'))->not->toHaveKey('download_url');
});

it('resolves music tracks whose title key is entirely absent, not just empty', function () {
    // Distinct from the "falling back to filename when untitled" test above
    // (title: '' -- key present, empty string). The builder can save a
    // track with no 'title' key in the array at all (confirmed via a real
    // EPK's stored config), which crashes differently: `$track['title'] ?:
    // ...` dereferences the key before checking truthiness, so a genuinely
    // missing key throws "Undefined array key" -- `??` doesn't.
    $epk = makePublishedEpk();
    $audio = Media::factory()->create(['workspace_id' => $epk->workspace_id, 'original_filename' => 'live-take.mp3']);

    $epk->sections()->create([
        'type' => SectionType::Music,
        'is_enabled' => true,
        'position' => 0,
        'config' => ['tracks' => [['provider' => 'upload', 'audio_media_id' => $audio->id]]],
    ]);

    $response = $this->getJson("/api/public/epks/{$epk->slug}");

    $response->assertOk();
    $response->assertJsonPath('data.sections.0.config.tracks.0.title', 'live-take.mp3');
    $response->assertJsonPath('data.sections.0.config.tracks.0.audio_url', $audio->url());
});

it('exposes a section-level download-all-as-zip url when the music section has at least one uploaded track', function () {
    $epk = makePublishedEpk();
    $audio = Media::factory()->create(['workspace_id' => $epk->workspace_id]);

    $epk->sections()->create([
        'type' => SectionType::Music,
        'is_enabled' => true,
        'position' => 0,
        'config' => ['tracks' => [['title' => 'One', 'provider' => 'upload', 'audio_media_id' => $audio->id]]],
    ]);

    $response = $this->getJson("/api/public/epks/{$epk->slug}");

    $response->assertOk();
    $response->assertJsonPath(
        'data.sections.0.config.download_all_url',
        route('public.epk.music.download-all', ['slug' => $epk->slug])
    );
});

it('omits the download-all url when the music section has no uploaded tracks', function () {
    $epk = makePublishedEpk();

    $epk->sections()->create([
        'type' => SectionType::Music,
        'is_enabled' => true,
        'position' => 0,
        'config' => ['tracks' => [
            ['title' => 'On Spotify', 'provider' => 'spotify', 'url' => 'https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC'],
        ]],
    ]);

    $response = $this->getJson("/api/public/epks/{$epk->slug}");

    $response->assertOk();
    expect($response->json('data.sections.0.config'))->not->toHaveKey('download_all_url');
});

it('resolves spotify/soundcloud embed tracks alongside uploaded audio', function () {
    $epk = makePublishedEpk();
    $upload = Media::factory()->create(['workspace_id' => $epk->workspace_id, 'original_filename' => 'live-take.mp3']);

    $epk->sections()->create([
        'type' => SectionType::Music,
        'is_enabled' => true,
        'position' => 0,
        'config' => ['tracks' => [
            ['title' => 'Uploaded track', 'provider' => 'upload', 'audio_media_id' => $upload->id],
            ['title' => 'On Spotify', 'provider' => 'spotify', 'url' => 'https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC'],
            ['title' => 'On SoundCloud', 'provider' => 'soundcloud', 'url' => 'https://soundcloud.com/artist/track-name'],
            ['title' => 'Broken embed', 'provider' => 'spotify', 'url' => 'not-a-url'],
        ]],
    ]);

    $response = $this->getJson("/api/public/epks/{$epk->slug}");

    $response->assertOk();
    $tracks = $response->json('data.sections.0.config.tracks');
    expect($tracks)->toHaveCount(3);
    expect($tracks[0]['audio_url'])->toBe($upload->url());
    expect($tracks[1]['embed_url'])->toBe('https://open.spotify.com/embed/track/4uLU6hMCjMI75M1A2tKUQC');
    expect($tracks[2]['embed_url'])->toBe(
        'https://w.soundcloud.com/player/?url=https%3A%2F%2Fsoundcloud.com%2Fartist%2Ftrack-name&color=%23ff5500&auto_play=false&show_comments=false&visual=false'
    );
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

it('converts youtube/vimeo urls to embed urls, dropping uploaded videos and broken links', function () {
    // Uploaded videos are no longer a supported provider (removed to avoid
    // hosting/bandwidth costs of self-hosted video) -- a track saved with
    // provider: 'upload' from before the change is silently dropped, same
    // as any other unrecognized/broken provider, rather than resolved.
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
    expect($videos)->toHaveCount(2);
    expect($videos[0]['embed_url'])->toBe('https://www.youtube.com/embed/dQw4w9WgXcQ');
    expect($videos[1]['embed_url'])->toBe('https://player.vimeo.com/video/123456789');
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

it('resolves events: drops empty entries, sorts by date ascending, and flags past ones', function () {
    $epk = makePublishedEpk();

    $epk->sections()->create([
        'type' => SectionType::Events,
        'is_enabled' => true,
        'position' => 0,
        'config' => ['events' => [
            ['title' => 'Later show', 'type' => 'headline', 'date' => now()->addMonths(3)->format('Y-m-d'), 'venue' => 'The Fillmore', 'city' => 'San Francisco', 'ticket_url' => 'https://tix.example/2'],
            ['title' => 'Past show', 'type' => 'festival', 'date' => now()->subMonths(2)->format('Y-m-d'), 'venue' => 'Roskilde', 'city' => 'Denmark'],
            ['title' => 'Soon show', 'type' => 'support', 'date' => now()->addMonths(1)->format('Y-m-d'), 'venue' => 'Bowery Ballroom', 'city' => 'New York'],
            ['title' => 'Nothing', 'type' => 'other'],
        ]],
    ]);

    $response = $this->getJson("/api/public/epks/{$epk->slug}");

    $response->assertOk();
    $events = $response->json('data.sections.0.config.events');
    expect($events)->toHaveCount(3);
    expect(array_column($events, 'title'))->toBe(['Past show', 'Soon show', 'Later show']);
    expect($events[0]['is_past'])->toBeTrue();
    expect($events[1]['is_past'])->toBeFalse();
    expect($events[2])->toMatchArray([
        'title' => 'Later show',
        'type' => 'headline',
        'date' => now()->addMonths(3)->format('Y-m-d'),
        'venue' => 'The Fillmore',
        'city' => 'San Francisco',
        'ticket_url' => 'https://tix.example/2',
        'is_past' => false,
    ]);
});

it('keeps an event with a venue but no date, sorting it after dated events', function () {
    $epk = makePublishedEpk();

    $epk->sections()->create([
        'type' => SectionType::Events,
        'is_enabled' => true,
        'position' => 0,
        'config' => ['events' => [
            ['venue' => 'TBA venue', 'city' => 'Berlin'],
            ['title' => 'Dated', 'date' => now()->addMonths(1)->format('Y-m-d'), 'venue' => 'Club'],
        ]],
    ]);

    $events = $this->getJson("/api/public/epks/{$epk->slug}")->json('data.sections.0.config.events');
    expect($events)->toHaveCount(2);
    expect($events[0]['title'])->toBe('Dated');
    expect($events[1]['venue'])->toBe('TBA venue');
    expect($events[1]['date'])->toBeNull();
    expect($events[1]['is_past'])->toBeFalse();
});

it('treats an event dated today as upcoming, not past', function () {
    $epk = makePublishedEpk();

    $epk->sections()->create([
        'type' => SectionType::Events,
        'is_enabled' => true,
        'position' => 0,
        'config' => ['events' => [
            ['date' => now()->format('Y-m-d'), 'venue' => 'Tonight'],
        ]],
    ]);

    $events = $this->getJson("/api/public/epks/{$epk->slug}")->json('data.sections.0.config.events');
    expect($events[0]['is_past'])->toBeFalse();
});
