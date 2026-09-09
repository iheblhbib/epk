<?php

use App\Enums\EpkStatus;
use App\Enums\SectionType;
use App\Enums\SubscriptionStatus;
use App\Models\Artist;
use App\Models\Epk;
use App\Models\Media;
use App\Models\PrivateLink;
use App\Models\Workspace;
use Illuminate\Support\Facades\Storage;

/**
 * A private link only works for a Published EPK -- same requirement as the
 * public page. epkWithLink() defaults to Published so every test below is
 * exercising the "otherwise-active" link; tests for the unpublished cases
 * override status explicitly.
 */
function epkWithLink(array $epkAttributes = [], array $linkAttributes = []): PrivateLink
{
    $workspace = Workspace::factory()->create();
    $artist = Artist::factory()->create(['workspace_id' => $workspace->id]);
    $epk = Epk::factory()->create(array_merge([
        'workspace_id' => $workspace->id,
        'artist_id' => $artist->id,
        'title' => 'Unreleased EPK',
        'status' => EpkStatus::Published,
    ], $epkAttributes));

    return PrivateLink::factory()->for($epk)->create($linkAttributes);
}

it('serves a published epk through a private link with no password', function () {
    $link = epkWithLink();

    $response = $this->getJson("/api/private/{$link->token}");

    $response->assertOk();
    $response->assertJsonPath('data.title', 'Unreleased EPK');
});

it('increments the view counter on each successful view', function () {
    $link = epkWithLink();
    expect($link->view_count)->toBe(0);

    $this->getJson("/api/private/{$link->token}")->assertOk();
    $this->getJson("/api/private/{$link->token}")->assertOk();

    expect($link->fresh()->view_count)->toBe(2);
    expect($link->fresh()->last_viewed_at)->not->toBeNull();
});

it('requires a password when the link has one, and rejects the wrong one', function () {
    $link = epkWithLink();
    $link->setPassword('correct-horse');
    $link->save();

    $this->getJson("/api/private/{$link->token}")
        ->assertUnauthorized()
        ->assertJsonPath('requires_password', true);

    $this->postJson("/api/private/{$link->token}/verify", ['password' => 'wrong-password'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('password');
});

it('grants access after the correct password, and remembers it for the session', function () {
    $link = epkWithLink();
    $link->setPassword('correct-horse');
    $link->save();

    $this->postJson("/api/private/{$link->token}/verify", ['password' => 'correct-horse'])
        ->assertOk()
        ->assertJsonPath('data.title', 'Unreleased EPK');

    // Same test-session cookie jar — no password needed the second time.
    $this->getJson("/api/private/{$link->token}")->assertOk();
});

it('410s an expired link', function () {
    $link = epkWithLink([], ['expires_at' => now()->subHour()]);

    $this->getJson("/api/private/{$link->token}")->assertStatus(410);
});

it('410s a revoked link', function () {
    $link = epkWithLink([], ['revoked_at' => now()]);

    $this->getJson("/api/private/{$link->token}")->assertStatus(410);
});

it('410s a private link when the epk is a draft (not yet published)', function () {
    $link = epkWithLink(['status' => EpkStatus::Draft]);

    $this->getJson("/api/private/{$link->token}")->assertStatus(410);
});

it('410s a private link when the epk is unpublished after having been published', function () {
    $link = epkWithLink();

    $link->epk->update(['status' => EpkStatus::Draft]);

    $this->getJson("/api/private/{$link->token}")->assertStatus(410);
});

it('410s a private link when the epk is archived', function () {
    $link = epkWithLink();
    $link->epk->update(['status' => EpkStatus::Archived]);

    $this->getJson("/api/private/{$link->token}")->assertStatus(410);
});

it('410s a private link when the epk has been deleted', function () {
    // Deleting an EPK from the dashboard is the only "remove this EPK" action
    // that actually exists in the product -- there's no UI path that ever
    // sets status to Archived. Delete soft-deletes (Epk uses SoftDeletes),
    // which excludes it from the default `epk()` relation query entirely,
    // so this has to be checked explicitly rather than falling out of the
    // Archived-status check above.
    $link = epkWithLink();
    $link->epk->delete();

    $this->getJson("/api/private/{$link->token}")->assertStatus(410);
});

it('410s a private link when the workspace owner\'s account is suspended', function () {
    $link = epkWithLink();
    // suspended_at is deliberately not mass-assignable (see AdminUserController,
    // the only real code path that sets it) -- direct property assignment,
    // same as it does.
    $creator = $link->epk->workspace->creator;
    $creator->suspended_at = now();
    $creator->save();

    $this->getJson("/api/private/{$link->token}")->assertStatus(410);
});

it('410s a private link when the workspace subscription is not active', function () {
    $link = epkWithLink();
    $link->epk->workspace->subscription()->update([
        'status' => SubscriptionStatus::Canceled,
        'trial_ends_at' => null,
    ]);

    $this->getJson("/api/private/{$link->token}")->assertStatus(410);
});

it('404s an unknown token', function () {
    $this->getJson('/api/private/not-a-real-token')->assertNotFound();
});

it('streams a downloads-section file through the private link', function () {
    Storage::fake('public');
    $link = epkWithLink();
    $media = Media::factory()->create([
        'workspace_id' => $link->epk->workspace_id,
        'disk' => 'public',
        'path' => 'workspaces/1/media/document/kit.pdf',
        'original_filename' => 'kit.pdf',
    ]);
    Storage::disk('public')->put($media->path, 'fake bytes');
    $link->epk->sections()->create([
        'type' => SectionType::Downloads, 'is_enabled' => true, 'position' => 0,
        'config' => ['media_ids' => [$media->id]],
    ]);

    $response = $this->get("/api/private/{$link->token}/downloads/{$media->id}");

    $response->assertOk();
    expect($response->headers->get('Content-Disposition'))->toContain('attachment');
});

it('streams a music track file through the private link, not just downloads-section files', function () {
    Storage::fake('public');
    $link = epkWithLink();
    $media = Media::factory()->create([
        'workspace_id' => $link->epk->workspace_id,
        'disk' => 'public',
        'path' => 'workspaces/1/media/audio/live-take.mp3',
        'original_filename' => 'live-take.mp3',
    ]);
    Storage::disk('public')->put($media->path, 'fake mp3 bytes');
    $link->epk->sections()->create([
        'type' => SectionType::Music, 'is_enabled' => true, 'position' => 0,
        'config' => ['tracks' => [['title' => 'Live Take', 'provider' => 'upload', 'audio_media_id' => $media->id]]],
    ]);

    $response = $this->get("/api/private/{$link->token}/downloads/{$media->id}");

    $response->assertOk();
    expect($response->headers->get('Content-Disposition'))->toContain('attachment');
    expect($response->headers->get('Content-Disposition'))->toContain('live-take.mp3');
});

it('downloads all uploaded music tracks as a single zip through the private link', function () {
    Storage::fake('public');
    $link = epkWithLink();
    $trackOne = Media::factory()->create([
        'workspace_id' => $link->epk->workspace_id, 'disk' => 'public',
        'path' => 'workspaces/1/media/audio/one.mp3', 'original_filename' => 'one.mp3',
    ]);
    $trackTwo = Media::factory()->create([
        'workspace_id' => $link->epk->workspace_id, 'disk' => 'public',
        'path' => 'workspaces/1/media/audio/two.mp3', 'original_filename' => 'two.mp3',
    ]);
    Storage::disk('public')->put($trackOne->path, 'fake bytes one');
    Storage::disk('public')->put($trackTwo->path, 'fake bytes two');

    $link->epk->sections()->create([
        'type' => SectionType::Music, 'is_enabled' => true, 'position' => 0,
        'config' => ['tracks' => [
            ['title' => 'One', 'provider' => 'upload', 'audio_media_id' => $trackOne->id],
            ['title' => 'Two', 'provider' => 'upload', 'audio_media_id' => $trackTwo->id],
        ]],
    ]);

    $response = $this->get(route('private.music.download-all', ['token' => $link->token]));

    $response->assertOk();
    expect($response->headers->get('Content-Type'))->toBe('application/zip');
    expect($response->headers->get('Content-Disposition'))->toContain('unreleased-epk-music.zip');

    $zipPath = storage_path('framework/testing/downloaded-private.zip');
    file_put_contents($zipPath, $response->streamedContent());
    $zip = new ZipArchive;
    $zip->open($zipPath);
    expect($zip->numFiles)->toBe(2);
    $zip->close();
    unlink($zipPath);
});

it('requires the password before allowing the download-all zip on a password-protected link', function () {
    $link = epkWithLink();
    $link->setPassword('correct-horse');
    $link->save();
    $link->epk->sections()->create([
        'type' => SectionType::Music, 'is_enabled' => true, 'position' => 0,
        'config' => ['tracks' => [['title' => 'One', 'provider' => 'upload', 'audio_media_id' => 999999]]],
    ]);

    $this->get(route('private.music.download-all', ['token' => $link->token]))->assertUnauthorized();
});

it('downloads all files in a downloads section as a single zip through the private link', function () {
    Storage::fake('public');
    $link = epkWithLink();
    $fileOne = Media::factory()->create([
        'workspace_id' => $link->epk->workspace_id, 'disk' => 'public',
        'path' => 'workspaces/1/media/document/one.pdf', 'original_filename' => 'one.pdf',
    ]);
    $fileTwo = Media::factory()->create([
        'workspace_id' => $link->epk->workspace_id, 'disk' => 'public',
        'path' => 'workspaces/1/media/document/two.pdf', 'original_filename' => 'two.pdf',
    ]);
    Storage::disk('public')->put($fileOne->path, 'fake bytes one');
    Storage::disk('public')->put($fileTwo->path, 'fake bytes two');

    $link->epk->sections()->create([
        'type' => SectionType::Downloads, 'is_enabled' => true, 'position' => 0,
        'config' => ['media_ids' => [$fileOne->id, $fileTwo->id]],
    ]);

    $response = $this->get(route('private.downloads.download-all', ['token' => $link->token]));

    $response->assertOk();
    expect($response->headers->get('Content-Type'))->toBe('application/zip');
    expect($response->headers->get('Content-Disposition'))->toContain('unreleased-epk-files.zip');

    $zipPath = storage_path('framework/testing/downloaded-files-private.zip');
    file_put_contents($zipPath, $response->streamedContent());
    $zip = new ZipArchive;
    $zip->open($zipPath);
    expect($zip->numFiles)->toBe(2);
    $zip->close();
    unlink($zipPath);
});

it('requires the password before allowing the downloads-section download-all zip on a password-protected link', function () {
    $link = epkWithLink();
    $link->setPassword('correct-horse');
    $link->save();
    $link->epk->sections()->create([
        'type' => SectionType::Downloads, 'is_enabled' => true, 'position' => 0,
        'config' => ['media_ids' => [999999]],
    ]);

    $this->get(route('private.downloads.download-all', ['token' => $link->token]))->assertUnauthorized();
});

it('records an analytics event scoped to the private link', function () {
    $link = epkWithLink();

    $this->postJson("/api/private/{$link->token}/events", ['type' => 'page_view'])->assertCreated();

    $this->assertDatabaseHas('analytics_events', [
        'epk_id' => $link->epk_id,
        'private_link_id' => $link->id,
        'type' => 'page_view',
    ]);
});

it('resolves download urls through the private route, not the public one', function () {
    $link = epkWithLink();
    $media = Media::factory()->create(['workspace_id' => $link->epk->workspace_id]);
    $link->epk->sections()->create([
        'type' => SectionType::Downloads, 'is_enabled' => true, 'position' => 0,
        'config' => ['media_ids' => [$media->id]],
    ]);

    $response = $this->getJson("/api/private/{$link->token}");

    $url = $response->json('data.sections.0.config.files.0.url');
    expect($url)->toContain("/private/{$link->token}/downloads/{$media->id}");
});
