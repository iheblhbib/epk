<?php

use App\Enums\WorkspaceRole;
use App\Models\Artist;
use App\Models\Epk;
use App\Models\User;
use App\Models\Workspace;

function shareTestWorkspaceWithOwner(): array
{
    $workspace = Workspace::factory()->create();
    $owner = User::factory()->create();
    $workspace->members()->create(['user_id' => $owner->id, 'role' => WorkspaceRole::Owner, 'status' => 'active', 'joined_at' => now()]);

    return [$workspace, $owner];
}

it('renders open graph and twitter card tags for a published epk, and redirects to the real page', function () {
    [$workspace, $owner] = shareTestWorkspaceWithOwner();
    $artist = Artist::factory()->create(['workspace_id' => $workspace->id, 'short_bio' => 'A dream-pop duo from Lisbon.']);
    $epk = Epk::factory()->published()->create([
        'workspace_id' => $workspace->id,
        'artist_id' => $artist->id,
        'title' => 'Midnight Echoes',
        'seo_title' => null,
        'seo_description' => null,
    ]);

    $response = $this->get("/e/{$epk->slug}");

    $response->assertOk();
    $response->assertSee('Midnight Echoes', false);
    $response->assertSee('A dream-pop duo from Lisbon.', false);
    $response->assertSee('property="og:title" content="Midnight Echoes"', false);
    $response->assertSee('name="twitter:card" content="summary"', false);

    $frontendUrl = rtrim((string) config('app.frontend_url'), '/');
    $response->assertSee("{$frontendUrl}/epk/{$epk->slug}", false);
});

it('prefers seo_title/seo_description and uses a large image card once a cover image exists', function () {
    [$workspace, $owner] = shareTestWorkspaceWithOwner();
    $artist = Artist::factory()->create(['workspace_id' => $workspace->id]);
    $epk = Epk::factory()->published()->create([
        'workspace_id' => $workspace->id,
        'artist_id' => $artist->id,
        'title' => 'Midnight Echoes',
        'seo_title' => 'Midnight Echoes — Official EPK',
        'seo_description' => 'Custom SEO blurb.',
        'cover_image_path' => 'covers/midnight-echoes.jpg',
    ]);

    $response = $this->get("/e/{$epk->slug}");

    $response->assertOk();
    $response->assertSee('property="og:title" content="Midnight Echoes — Official EPK"', false);
    $response->assertSee('Custom SEO blurb.', false);
    $response->assertSee('name="twitter:card" content="summary_large_image"', false);
    $response->assertSee('property="og:image"', false);
});

it('404s the share page for a draft or archived epk', function () {
    [$workspace, $owner] = shareTestWorkspaceWithOwner();
    $artist = Artist::factory()->create(['workspace_id' => $workspace->id]);
    $draft = Epk::factory()->create(['workspace_id' => $workspace->id, 'artist_id' => $artist->id]);

    $this->get("/e/{$draft->slug}")->assertNotFound();
});

it('404s an unknown slug', function () {
    $this->get('/e/does-not-exist')->assertNotFound();
});

it('only exposes share_url once the epk is published', function () {
    [$workspace, $owner] = shareTestWorkspaceWithOwner();
    $artist = Artist::factory()->create(['workspace_id' => $workspace->id]);
    $draft = Epk::factory()->create(['workspace_id' => $workspace->id, 'artist_id' => $artist->id]);

    $this->actingAs($owner)->getJson("/api/epks/{$draft->id}")
        ->assertOk()
        ->assertJsonPath('data.share_url', null);

    $draft->update(['status' => 'published', 'published_at' => now()]);

    $this->actingAs($owner)->getJson("/api/epks/{$draft->id}")
        ->assertOk()
        ->assertJsonPath('data.share_url', route('epk.share', $draft->slug));
});
