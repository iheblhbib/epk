<?php

use App\Enums\ContactCategory;
use App\Enums\WorkspaceRole;
use App\Models\Contact;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

function contactWorkspaceWithMember(WorkspaceRole $role): array
{
    $workspace = Workspace::factory()->create();
    $user = User::factory()->create();
    $workspace->members()->create(['user_id' => $user->id, 'role' => $role, 'status' => 'active', 'joined_at' => now()]);

    return [$workspace, $user];
}

it('lets an editor create a contact', function () {
    [$workspace, $editor] = contactWorkspaceWithMember(WorkspaceRole::Editor);

    $response = $this->actingAs($editor)->postJson("/api/workspaces/{$workspace->id}/contacts", [
        'name' => 'Jane Critic',
        'email' => 'jane@example.com',
        'category' => 'journalist',
        'organization' => 'Music Weekly',
    ]);

    $response->assertCreated();
    $response->assertJsonPath('data.name', 'Jane Critic');
    $response->assertJsonPath('data.category', 'journalist');
    $response->assertJsonPath('data.category_label', 'Journalist');
    $this->assertDatabaseHas('contacts', ['workspace_id' => $workspace->id, 'name' => 'Jane Critic']);
});

it('defaults to the other category when none is given', function () {
    [$workspace, $editor] = contactWorkspaceWithMember(WorkspaceRole::Editor);

    $response = $this->actingAs($editor)->postJson("/api/workspaces/{$workspace->id}/contacts", ['name' => 'No Category']);

    $response->assertCreated();
    $response->assertJsonPath('data.category', 'other');
});

it('denies a viewer from creating a contact', function () {
    [$workspace, $viewer] = contactWorkspaceWithMember(WorkspaceRole::Viewer);

    $this->actingAs($viewer)
        ->postJson("/api/workspaces/{$workspace->id}/contacts", ['name' => 'Nope'])
        ->assertForbidden();
});

it('searches contacts by name, email, and organization', function () {
    [$workspace, $viewer] = contactWorkspaceWithMember(WorkspaceRole::Viewer);
    Contact::factory()->for($workspace)->create(['name' => 'Alice Reporter', 'email' => 'x@y.com', 'organization' => 'Z Mag']);
    Contact::factory()->for($workspace)->create(['name' => 'Bob DJ', 'email' => 'alice@radio.fm', 'organization' => 'Radio One']);
    Contact::factory()->for($workspace)->create(['name' => 'Carol', 'email' => 'c@c.com', 'organization' => 'Alice Records']);

    $response = $this->actingAs($viewer)->getJson("/api/workspaces/{$workspace->id}/contacts?search=alice");

    $response->assertOk();
    expect($response->json('data'))->toHaveCount(3);
});

it('filters contacts by category', function () {
    [$workspace, $viewer] = contactWorkspaceWithMember(WorkspaceRole::Viewer);
    Contact::factory()->for($workspace)->category(ContactCategory::Radio)->create();
    Contact::factory()->for($workspace)->category(ContactCategory::Journalist)->count(2)->create();

    $response = $this->actingAs($viewer)->getJson("/api/workspaces/{$workspace->id}/contacts?category=journalist");

    $response->assertOk();
    expect($response->json('data'))->toHaveCount(2);
});

it('updates a contact', function () {
    [$workspace, $editor] = contactWorkspaceWithMember(WorkspaceRole::Editor);
    $contact = Contact::factory()->for($workspace)->create(['name' => 'Old Name']);

    $response = $this->actingAs($editor)->putJson("/api/contacts/{$contact->id}", ['name' => 'New Name']);

    $response->assertOk();
    $response->assertJsonPath('data.name', 'New Name');
});

it('deletes a contact', function () {
    [$workspace, $editor] = contactWorkspaceWithMember(WorkspaceRole::Editor);
    $contact = Contact::factory()->for($workspace)->create();

    $this->actingAs($editor)->deleteJson("/api/contacts/{$contact->id}")->assertOk();

    $this->assertSoftDeleted('contacts', ['id' => $contact->id]);
});

it('exports contacts as csv', function () {
    [$workspace, $viewer] = contactWorkspaceWithMember(WorkspaceRole::Viewer);
    Contact::factory()->for($workspace)->create(['name' => 'Export Me', 'email' => 'e@e.com', 'category' => ContactCategory::Blog]);

    $response = $this->actingAs($viewer)->get("/api/workspaces/{$workspace->id}/contacts/export");

    $response->assertOk();
    $response->assertHeader('Content-Type', 'text/csv; charset=UTF-8');
    $content = $response->streamedContent();
    expect($content)->toContain('name,email,phone,category,organization,notes');
    expect($content)->toContain('Export Me');
    expect($content)->toContain('blog');
});

it('escapes CSV formula injection in exported fields', function () {
    [$workspace, $viewer] = contactWorkspaceWithMember(WorkspaceRole::Viewer);
    Contact::factory()->for($workspace)->create([
        'name' => '=cmd|\'/c calc\'!A1',
        'organization' => '+1 malicious',
        'notes' => '@SUM(1+1)',
    ]);

    $content = $this->actingAs($viewer)
        ->get("/api/workspaces/{$workspace->id}/contacts/export")
        ->streamedContent();

    expect($content)->toContain("'=cmd|'/c calc'!A1");
    expect($content)->toContain("'+1 malicious");
    expect($content)->toContain("'@SUM(1+1)");
    // Never raw at the start of a field — always guarded by the leading quote.
    expect($content)->not->toContain(',=cmd');
});

it('imports contacts from a csv file', function () {
    [$workspace, $editor] = contactWorkspaceWithMember(WorkspaceRole::Editor);
    Storage::fake('local');

    $csv = "name,email,category\nJohn Doe,john@example.com,journalist\nJane Roe,jane@example.com,radio\n,missing@name.com,blog\n";
    $file = UploadedFile::fake()->createWithContent('contacts.csv', $csv);

    $response = $this->actingAs($editor)->postJson("/api/workspaces/{$workspace->id}/contacts/import", ['file' => $file]);

    $response->assertOk();
    $response->assertJsonPath('data.created', 2);
    $response->assertJsonPath('data.skipped', 1);
    $this->assertDatabaseHas('contacts', ['workspace_id' => $workspace->id, 'name' => 'John Doe', 'category' => 'journalist']);
    $this->assertDatabaseHas('contacts', ['workspace_id' => $workspace->id, 'name' => 'Jane Roe', 'category' => 'radio']);
});

it('rejects an import file with no recognizable header', function () {
    [$workspace, $editor] = contactWorkspaceWithMember(WorkspaceRole::Editor);
    Storage::fake('local');

    $csv = "foo,bar,baz\n1,2,3\n";
    $file = UploadedFile::fake()->createWithContent('contacts.csv', $csv);

    $response = $this->actingAs($editor)->postJson("/api/workspaces/{$workspace->id}/contacts/import", ['file' => $file]);

    $response->assertOk();
    $response->assertJsonPath('data.created', 0);
    expect($response->json('data.errors'))->not->toBeEmpty();
});

it('denies a viewer from importing contacts', function () {
    [$workspace, $viewer] = contactWorkspaceWithMember(WorkspaceRole::Viewer);
    Storage::fake('local');
    $file = UploadedFile::fake()->createWithContent('contacts.csv', "name\nSomeone\n");

    $this->actingAs($viewer)
        ->postJson("/api/workspaces/{$workspace->id}/contacts/import", ['file' => $file])
        ->assertForbidden();
});

it('rejects a non-csv import file', function () {
    [$workspace, $editor] = contactWorkspaceWithMember(WorkspaceRole::Editor);

    $file = UploadedFile::fake()->create('contacts.pdf', 10, 'application/pdf');

    $this->actingAs($editor)
        ->postJson("/api/workspaces/{$workspace->id}/contacts/import", ['file' => $file])
        ->assertUnprocessable();
});
