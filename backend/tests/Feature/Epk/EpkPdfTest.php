<?php

use App\Enums\SectionType;
use App\Enums\WorkspaceRole;
use App\Models\Artist;
use App\Models\Epk;
use App\Models\User;
use App\Models\Workspace;

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
