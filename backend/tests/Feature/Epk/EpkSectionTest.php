<?php

use App\Enums\SectionType;
use App\Enums\WorkspaceRole;
use App\Models\Artist;
use App\Models\Epk;
use App\Models\EpkSection;
use App\Models\User;
use App\Models\Workspace;

function sectionWorkspaceWithMember(WorkspaceRole $role): array
{
    $workspace = Workspace::factory()->create();
    $user = User::factory()->create();
    $workspace->members()->create(['user_id' => $user->id, 'role' => $role, 'status' => 'active', 'joined_at' => now()]);

    return [$workspace, $user];
}

function makeEpk(Workspace $workspace): Epk
{
    $artist = Artist::factory()->create(['workspace_id' => $workspace->id]);

    return Epk::factory()->create(['workspace_id' => $workspace->id, 'artist_id' => $artist->id]);
}

it('lets an editor add a section with sensible defaults', function () {
    [$workspace, $editor] = sectionWorkspaceWithMember(WorkspaceRole::Editor);
    $epk = makeEpk($workspace);

    $response = $this->actingAs($editor)->postJson("/api/epks/{$epk->id}/sections", [
        'type' => SectionType::Biography->value,
    ]);

    $response->assertCreated();
    $response->assertJsonPath('data.type', 'biography');
    $response->assertJsonPath('data.label', 'Biography');
    $response->assertJsonPath('data.is_enabled', true);
    expect($response->json('data.config'))->toBe(['html' => '']);
});

it('gives photos, music, releases, videos, and press sensible empty defaults', function () {
    [$workspace, $editor] = sectionWorkspaceWithMember(WorkspaceRole::Editor);
    $epk = makeEpk($workspace);

    $expected = [
        SectionType::Photos->value => ['items' => []],
        SectionType::Music->value => ['tracks' => []],
        SectionType::Releases->value => ['releases' => []],
        SectionType::Videos->value => ['videos' => []],
        SectionType::Press->value => ['items' => []],
    ];

    foreach ($expected as $type => $config) {
        $response = $this->actingAs($editor)->postJson("/api/epks/{$epk->id}/sections", ['type' => $type]);
        $response->assertCreated();
        expect($response->json('data.config'))->toBe($config);
    }
});

it('denies a viewer from adding a section', function () {
    [$workspace, $viewer] = sectionWorkspaceWithMember(WorkspaceRole::Viewer);
    $epk = makeEpk($workspace);

    $this->actingAs($viewer)
        ->postJson("/api/epks/{$epk->id}/sections", ['type' => SectionType::Biography->value])
        ->assertForbidden();
});

it('only allows one hero section per epk', function () {
    [$workspace, $editor] = sectionWorkspaceWithMember(WorkspaceRole::Editor);
    $epk = makeEpk($workspace);

    $this->actingAs($editor)
        ->postJson("/api/epks/{$epk->id}/sections", ['type' => SectionType::Hero->value])
        ->assertCreated();

    $this->actingAs($editor)
        ->postJson("/api/epks/{$epk->id}/sections", ['type' => SectionType::Hero->value])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('type');
});

it('appends new sections at the end of the position order', function () {
    [$workspace, $editor] = sectionWorkspaceWithMember(WorkspaceRole::Editor);
    $epk = makeEpk($workspace);

    $first = $this->actingAs($editor)->postJson("/api/epks/{$epk->id}/sections", ['type' => SectionType::Biography->value]);
    $second = $this->actingAs($editor)->postJson("/api/epks/{$epk->id}/sections", ['type' => SectionType::Contact->value]);

    expect($second->json('data.position'))->toBeGreaterThan($first->json('data.position'));
});

it('sanitizes html in biography and custom section config, stripping scripts', function () {
    [$workspace, $editor] = sectionWorkspaceWithMember(WorkspaceRole::Editor);
    $epk = makeEpk($workspace);
    $section = EpkSection::factory()->biography()->create(['epk_id' => $epk->id]);

    $response = $this->actingAs($editor)->putJson("/api/epks/{$epk->id}/sections/{$section->id}", [
        'config' => [
            'html' => '<h2>About</h2><p onclick="alert(1)">Hello <script>alert(1)</script><b>world</b></p><iframe src="evil"></iframe>',
        ],
    ]);

    $response->assertOk();
    $html = $response->json('data.config.html');

    expect($html)
        ->not->toContain('<script')
        ->not->toContain('onclick')
        ->not->toContain('<iframe')
        ->toContain('<h2>About</h2>')
        ->toContain('<b>world</b>');
});

it('does not sanitize config for non-richtext section types', function () {
    [$workspace, $editor] = sectionWorkspaceWithMember(WorkspaceRole::Editor);
    $epk = makeEpk($workspace);
    $section = EpkSection::factory()->create(['epk_id' => $epk->id, 'type' => SectionType::Contact, 'config' => []]);

    $response = $this->actingAs($editor)->putJson("/api/epks/{$epk->id}/sections/{$section->id}", [
        'config' => ['phone' => '+1 555 0100', 'booking_email' => 'booking@example.com'],
    ]);

    $response->assertOk();
    expect($response->json('data.config.phone'))->toBe('+1 555 0100');
});

it('toggles a section enabled/disabled', function () {
    [$workspace, $editor] = sectionWorkspaceWithMember(WorkspaceRole::Editor);
    $epk = makeEpk($workspace);
    $section = EpkSection::factory()->create(['epk_id' => $epk->id, 'is_enabled' => true]);

    $this->actingAs($editor)
        ->putJson("/api/epks/{$epk->id}/sections/{$section->id}", ['is_enabled' => false])
        ->assertOk()
        ->assertJsonPath('data.is_enabled', false);
});

it('duplicates a non-singleton section but blocks duplicating hero', function () {
    [$workspace, $editor] = sectionWorkspaceWithMember(WorkspaceRole::Editor);
    $epk = makeEpk($workspace);
    $bio = EpkSection::factory()->biography()->create(['epk_id' => $epk->id]);
    $hero = EpkSection::factory()->hero()->create(['epk_id' => $epk->id]);

    $this->actingAs($editor)
        ->postJson("/api/epks/{$epk->id}/sections/{$bio->id}/duplicate")
        ->assertCreated();

    $this->assertDatabaseCount('epk_sections', 3);

    $this->actingAs($editor)
        ->postJson("/api/epks/{$epk->id}/sections/{$hero->id}/duplicate")
        ->assertUnprocessable();
});

it('deletes a section', function () {
    [$workspace, $editor] = sectionWorkspaceWithMember(WorkspaceRole::Editor);
    $epk = makeEpk($workspace);
    $section = EpkSection::factory()->create(['epk_id' => $epk->id]);

    $this->actingAs($editor)
        ->deleteJson("/api/epks/{$epk->id}/sections/{$section->id}")
        ->assertOk();

    $this->assertDatabaseMissing('epk_sections', ['id' => $section->id]);
});

it('reorders sections by the given id sequence', function () {
    [$workspace, $editor] = sectionWorkspaceWithMember(WorkspaceRole::Editor);
    $epk = makeEpk($workspace);
    $a = EpkSection::factory()->create(['epk_id' => $epk->id, 'position' => 0]);
    $b = EpkSection::factory()->create(['epk_id' => $epk->id, 'position' => 1]);
    $c = EpkSection::factory()->create(['epk_id' => $epk->id, 'position' => 2]);

    $response = $this->actingAs($editor)->putJson("/api/epks/{$epk->id}/sections/reorder", [
        'section_ids' => [$c->id, $a->id, $b->id],
    ]);

    $response->assertOk();
    $ids = collect($response->json('data'))->pluck('id')->values();
    expect($ids->all())->toBe([$c->id, $a->id, $b->id]);
});

it('rejects a section id from a different epk when reordering', function () {
    [$workspace, $editor] = sectionWorkspaceWithMember(WorkspaceRole::Editor);
    $epk = makeEpk($workspace);
    $otherEpk = makeEpk($workspace);
    $foreignSection = EpkSection::factory()->create(['epk_id' => $otherEpk->id]);

    $this->actingAs($editor)
        ->putJson("/api/epks/{$epk->id}/sections/reorder", ['section_ids' => [$foreignSection->id]])
        ->assertUnprocessable();
});
