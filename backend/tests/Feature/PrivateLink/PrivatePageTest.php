<?php

use App\Enums\SectionType;
use App\Models\Artist;
use App\Models\Epk;
use App\Models\Media;
use App\Models\PrivateLink;
use App\Models\Workspace;
use Illuminate\Support\Facades\Storage;

function draftEpkWithLink(array $linkAttributes = []): PrivateLink
{
    $workspace = Workspace::factory()->create();
    $artist = Artist::factory()->create(['workspace_id' => $workspace->id]);
    $epk = Epk::factory()->create(['workspace_id' => $workspace->id, 'artist_id' => $artist->id, 'title' => 'Unreleased EPK']);

    return PrivateLink::factory()->for($epk)->create($linkAttributes);
}

it('serves a draft epk through a private link with no password', function () {
    $link = draftEpkWithLink();

    $response = $this->getJson("/api/private/{$link->token}");

    $response->assertOk();
    $response->assertJsonPath('data.title', 'Unreleased EPK');
});

it('increments the view counter on each successful view', function () {
    $link = draftEpkWithLink();
    expect($link->view_count)->toBe(0);

    $this->getJson("/api/private/{$link->token}")->assertOk();
    $this->getJson("/api/private/{$link->token}")->assertOk();

    expect($link->fresh()->view_count)->toBe(2);
    expect($link->fresh()->last_viewed_at)->not->toBeNull();
});

it('requires a password when the link has one, and rejects the wrong one', function () {
    $link = draftEpkWithLink();
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
    $link = draftEpkWithLink();
    $link->setPassword('correct-horse');
    $link->save();

    $this->postJson("/api/private/{$link->token}/verify", ['password' => 'correct-horse'])
        ->assertOk()
        ->assertJsonPath('data.title', 'Unreleased EPK');

    // Same test-session cookie jar — no password needed the second time.
    $this->getJson("/api/private/{$link->token}")->assertOk();
});

it('410s an expired link', function () {
    $link = draftEpkWithLink(['expires_at' => now()->subHour()]);

    $this->getJson("/api/private/{$link->token}")->assertStatus(410);
});

it('410s a revoked link', function () {
    $link = draftEpkWithLink(['revoked_at' => now()]);

    $this->getJson("/api/private/{$link->token}")->assertStatus(410);
});

it('404s an unknown token', function () {
    $this->getJson('/api/private/not-a-real-token')->assertNotFound();
});

it('streams a downloads-section file through the private link', function () {
    Storage::fake('public');
    $link = draftEpkWithLink();
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

it('records an analytics event scoped to the private link', function () {
    $link = draftEpkWithLink();

    $this->postJson("/api/private/{$link->token}/events", ['type' => 'page_view'])->assertCreated();

    $this->assertDatabaseHas('analytics_events', [
        'epk_id' => $link->epk_id,
        'private_link_id' => $link->id,
        'type' => 'page_view',
    ]);
});

it('does not resolve the public download route for a non-published epk', function () {
    $link = draftEpkWithLink();
    $media = Media::factory()->create(['workspace_id' => $link->epk->workspace_id]);
    $link->epk->sections()->create([
        'type' => SectionType::Downloads, 'is_enabled' => true, 'position' => 0,
        'config' => ['media_ids' => [$media->id]],
    ]);

    $response = $this->getJson("/api/private/{$link->token}");

    // The resolved download URL must be the private route, not the public
    // one (which would 404 for this draft epk regardless of link validity).
    $url = $response->json('data.sections.0.config.files.0.url');
    expect($url)->toContain("/private/{$link->token}/downloads/{$media->id}");
});
