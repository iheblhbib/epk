<?php

use App\Enums\SubscriptionPlan;
use App\Enums\WorkspaceRole;
use App\Models\Artist;
use App\Models\Epk;
use App\Models\User;
use App\Models\Workspace;
use App\Services\DnsTxtRecordChecker;

function customDomainWorkspaceWithEditor(SubscriptionPlan $plan = SubscriptionPlan::Business): array
{
    $workspace = Workspace::factory()->create();
    $editor = User::factory()->create();
    $workspace->members()->create(['user_id' => $editor->id, 'role' => WorkspaceRole::Editor, 'status' => 'active', 'joined_at' => now()]);
    $workspace->subscription()->update(['plan' => $plan]);
    $artist = Artist::factory()->create(['workspace_id' => $workspace->id]);
    $epk = Epk::factory()->create(['workspace_id' => $workspace->id, 'artist_id' => $artist->id]);

    return [$workspace, $editor, $epk];
}

it('returns null instructions before any domain has been set up', function () {
    [, $editor, $epk] = customDomainWorkspaceWithEditor();

    $response = $this->actingAs($editor)->getJson("/api/epks/{$epk->id}/custom-domain")->assertOk();

    expect($response->json('data'))->toBeNull();
});

it('re-fetches the same instructions without regenerating the token', function () {
    [, $editor, $epk] = customDomainWorkspaceWithEditor();
    $created = $this->actingAs($editor)
        ->postJson("/api/epks/{$epk->id}/custom-domain", ['domain' => 'press.example.com'])
        ->json('data');

    $fetched = $this->actingAs($editor)->getJson("/api/epks/{$epk->id}/custom-domain")->assertOk()->json('data');

    expect($fetched)->toBe($created);
});

it('sets up a custom domain and returns the dns records to add', function () {
    [, $editor, $epk] = customDomainWorkspaceWithEditor();

    $response = $this->actingAs($editor)
        ->postJson("/api/epks/{$epk->id}/custom-domain", ['domain' => 'press.example.com'])
        ->assertOk();

    expect($response->json('data.domain'))->toBe('press.example.com');
    expect($response->json('data.verified'))->toBeFalse();
    expect($response->json('data.verification_record.type'))->toBe('TXT');
    expect($response->json('data.verification_record.host'))->toBe('_kitfolio-challenge.press.example.com');
    expect($response->json('data.verification_record.value'))->toBeString()->not->toBeEmpty();
    expect($response->json('data.routing_record.type'))->toBe('CNAME');
    expect($response->json('data.routing_record.host'))->toBe('press.example.com');

    expect($epk->fresh()->hasVerifiedCustomDomain())->toBeFalse();
});

it('requires the business plan', function () {
    [, $editor, $epk] = customDomainWorkspaceWithEditor(SubscriptionPlan::Pro);

    $this->actingAs($editor)
        ->postJson("/api/epks/{$epk->id}/custom-domain", ['domain' => 'press.example.com'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('domain');
});

it('rejects a malformed domain', function () {
    [, $editor, $epk] = customDomainWorkspaceWithEditor();

    $this->actingAs($editor)
        ->postJson("/api/epks/{$epk->id}/custom-domain", ['domain' => 'not a domain'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('domain');
});

it('rejects a domain already claimed by another epk', function () {
    [$workspace, $editor, $epk] = customDomainWorkspaceWithEditor();
    $artist = Artist::factory()->create(['workspace_id' => $workspace->id]);
    $otherEpk = Epk::factory()->create(['workspace_id' => $workspace->id, 'artist_id' => $artist->id, 'custom_domain' => 'press.example.com']);

    $this->actingAs($editor)
        ->postJson("/api/epks/{$epk->id}/custom-domain", ['domain' => 'press.example.com'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('domain');
});

it('denies a viewer from setting up a custom domain', function () {
    [$workspace, , $epk] = customDomainWorkspaceWithEditor();
    $viewer = User::factory()->create();
    $workspace->members()->create(['user_id' => $viewer->id, 'role' => WorkspaceRole::Viewer, 'status' => 'active', 'joined_at' => now()]);

    $this->actingAs($viewer)
        ->postJson("/api/epks/{$epk->id}/custom-domain", ['domain' => 'press.example.com'])
        ->assertForbidden();
});

it('verifies the domain once the txt record is found', function () {
    [, $editor, $epk] = customDomainWorkspaceWithEditor();
    $this->actingAs($editor)->postJson("/api/epks/{$epk->id}/custom-domain", ['domain' => 'press.example.com']);

    $this->mock(DnsTxtRecordChecker::class, function ($mock) {
        $mock->shouldReceive('matches')
            ->once()
            ->with('_kitfolio-challenge.press.example.com', $this->anything())
            ->andReturn(true);
    });

    $response = $this->actingAs($editor)->postJson("/api/epks/{$epk->id}/custom-domain/verify")->assertOk();

    expect($response->json('data.verified'))->toBeTrue();
    expect($epk->fresh()->hasVerifiedCustomDomain())->toBeTrue();
});

it('fails verification when the txt record is not found', function () {
    [, $editor, $epk] = customDomainWorkspaceWithEditor();
    $this->actingAs($editor)->postJson("/api/epks/{$epk->id}/custom-domain", ['domain' => 'press.example.com']);

    $this->mock(DnsTxtRecordChecker::class, function ($mock) {
        $mock->shouldReceive('matches')->once()->andReturn(false);
    });

    $this->actingAs($editor)
        ->postJson("/api/epks/{$epk->id}/custom-domain/verify")
        ->assertUnprocessable()
        ->assertJsonValidationErrors('domain');

    expect($epk->fresh()->hasVerifiedCustomDomain())->toBeFalse();
});

it('rejects verification when no domain has been set up', function () {
    [, $editor, $epk] = customDomainWorkspaceWithEditor();

    $this->actingAs($editor)
        ->postJson("/api/epks/{$epk->id}/custom-domain/verify")
        ->assertUnprocessable()
        ->assertJsonValidationErrors('domain');
});

it('removes a custom domain, clearing every related column', function () {
    [, $editor, $epk] = customDomainWorkspaceWithEditor();
    $this->actingAs($editor)->postJson("/api/epks/{$epk->id}/custom-domain", ['domain' => 'press.example.com']);

    $this->actingAs($editor)->deleteJson("/api/epks/{$epk->id}/custom-domain")->assertOk();

    $fresh = $epk->fresh();
    expect($fresh->custom_domain)->toBeNull();
    expect($fresh->custom_domain_token)->toBeNull();
    expect($fresh->custom_domain_verified_at)->toBeNull();
});

it('resolves a published epk publicly by its verified custom domain', function () {
    [, $editor, $epk] = customDomainWorkspaceWithEditor();
    $epk->update(['status' => 'published', 'published_at' => now()]);
    $this->actingAs($editor)->postJson("/api/epks/{$epk->id}/custom-domain", ['domain' => 'press.example.com']);

    $this->mock(DnsTxtRecordChecker::class, fn ($mock) => $mock->shouldReceive('matches')->once()->andReturn(true));
    $this->actingAs($editor)->postJson("/api/epks/{$epk->id}/custom-domain/verify")->assertOk();

    $response = $this->getJson('/api/public/epks/by-domain?domain=press.example.com')->assertOk();

    expect($response->json('data.title'))->toBe($epk->title);
});

it('404s a public lookup by an unverified custom domain', function () {
    [, $editor, $epk] = customDomainWorkspaceWithEditor();
    $epk->update(['status' => 'published', 'published_at' => now()]);
    $this->actingAs($editor)->postJson("/api/epks/{$epk->id}/custom-domain", ['domain' => 'press.example.com']);

    $this->getJson('/api/public/epks/by-domain?domain=press.example.com')->assertNotFound();
});

it('404s a public lookup by an unknown custom domain', function () {
    $this->getJson('/api/public/epks/by-domain?domain=nowhere.example.com')->assertNotFound();
});
