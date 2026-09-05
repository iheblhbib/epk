<?php

use App\Enums\MediaType;
use App\Enums\WorkspaceRole;
use App\Models\Media;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

function mediaWorkspaceWithRole(WorkspaceRole $role): array
{
    $workspace = Workspace::factory()->create();
    $user = User::factory()->create();
    $workspace->members()->create(['user_id' => $user->id, 'role' => $role, 'status' => 'active', 'joined_at' => now()]);

    return [$workspace, $user];
}

beforeEach(function () {
    Storage::fake('public');
});

it('lets an editor upload an image and generates a thumbnail', function () {
    [$workspace, $editor] = mediaWorkspaceWithRole(WorkspaceRole::Editor);

    $file = UploadedFile::fake()->image('cover.jpg', 800, 600);

    $response = $this->actingAs($editor)->postJson("/api/workspaces/{$workspace->id}/media", [
        'files' => [$file],
    ]);

    $response->assertCreated();
    // Every image is normalized to WebP -- both the stored file and the
    // client-facing name get the .webp extension, so a downloaded file's
    // name always matches its real content.
    $response->assertJsonPath('data.0.original_filename', 'cover.webp');
    $response->assertJsonPath('data.0.mime_type', 'image/webp');
    $response->assertJsonPath('data.0.type', 'image');
    expect($response->json('data.0.thumbnail_url'))->not->toBeNull();

    $this->assertDatabaseHas('media', [
        'workspace_id' => $workspace->id,
        'original_filename' => 'cover.webp',
        'type' => 'image',
    ]);

    $media = Media::first();
    Storage::disk('public')->assertExists($media->path);
    Storage::disk('public')->assertExists($media->thumbnail_path);
    // The stored filename must never be the client-supplied name.
    expect($media->filename)->not->toBe('cover.webp');
    expect($media->extension())->toBe('webp');
});

it('downscales an oversized image before storing it, to cap storage usage', function () {
    [$workspace, $editor] = mediaWorkspaceWithRole(WorkspaceRole::Editor);

    $file = UploadedFile::fake()->image('huge.jpg', 4000, 3000);

    $response = $this->actingAs($editor)->postJson("/api/workspaces/{$workspace->id}/media", [
        'files' => [$file],
    ]);

    $response->assertCreated();
    $media = Media::first();

    [$storedWidth, $storedHeight] = getimagesize(Storage::disk('public')->path($media->path));
    expect($storedWidth)->toBeLessThanOrEqual(2500);
    expect($storedHeight)->toBeLessThanOrEqual(2500);
    // Aspect ratio (4:3) must survive the resize.
    expect(round($storedWidth / $storedHeight, 2))->toBe(round(4000 / 3000, 2));

    expect($media->metadata['width'])->toBe($storedWidth);
    expect($media->metadata['height'])->toBe($storedHeight);
    // The recorded size must match what's actually on disk after the
    // resize, not the pre-resize upload size.
    expect($media->size)->toBe(Storage::disk('public')->size($media->path));
});

it('leaves an image already within the size cap untouched', function () {
    [$workspace, $editor] = mediaWorkspaceWithRole(WorkspaceRole::Editor);

    $file = UploadedFile::fake()->image('small.jpg', 800, 600);

    $this->actingAs($editor)->postJson("/api/workspaces/{$workspace->id}/media", ['files' => [$file]])->assertCreated();

    $media = Media::first();
    [$storedWidth, $storedHeight] = getimagesize(Storage::disk('public')->path($media->path));
    expect($storedWidth)->toBe(800);
    expect($storedHeight)->toBe(600);
});

it('converts uploaded images to webp regardless of original format', function () {
    [$workspace, $editor] = mediaWorkspaceWithRole(WorkspaceRole::Editor);

    $response = $this->actingAs($editor)->postJson("/api/workspaces/{$workspace->id}/media", [
        'files' => [UploadedFile::fake()->image('logo.png', 500, 500)],
    ]);

    $response->assertCreated();
    $media = Media::first();
    expect($media->original_filename)->toBe('logo.webp');
    expect($media->mime_type)->toBe('image/webp');
    expect(pathinfo($media->path, PATHINFO_EXTENSION))->toBe('webp');

    $imageInfo = getimagesize(Storage::disk('public')->path($media->path));
    expect($imageInfo['mime'])->toBe('image/webp');
});

it('uploads multiple files in one request', function () {
    [$workspace, $editor] = mediaWorkspaceWithRole(WorkspaceRole::Editor);

    $response = $this->actingAs($editor)->postJson("/api/workspaces/{$workspace->id}/media", [
        'files' => [
            UploadedFile::fake()->image('one.jpg'),
            UploadedFile::fake()->image('two.png'),
        ],
    ]);

    $response->assertCreated();
    expect($response->json('data'))->toHaveCount(2);
    $this->assertDatabaseCount('media', 2);
});

it('denies a viewer from uploading', function () {
    [$workspace, $viewer] = mediaWorkspaceWithRole(WorkspaceRole::Viewer);

    $this->actingAs($viewer)
        ->postJson("/api/workspaces/{$workspace->id}/media", ['files' => [UploadedFile::fake()->image('x.jpg')]])
        ->assertForbidden();
});

it('rejects a disallowed file extension, e.g. a php file', function () {
    [$workspace, $editor] = mediaWorkspaceWithRole(WorkspaceRole::Editor);

    $file = UploadedFile::fake()->create('shell.php', 10, 'application/x-php');

    $this->actingAs($editor)
        ->postJson("/api/workspaces/{$workspace->id}/media", ['files' => [$file]])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('files.0');

    $this->assertDatabaseCount('media', 0);
});

it('rejects a video upload -- no longer an allowed media library extension', function () {
    [$workspace, $editor] = mediaWorkspaceWithRole(WorkspaceRole::Editor);

    $file = UploadedFile::fake()->create('clip.mp4', 10, 'video/mp4');

    $this->actingAs($editor)
        ->postJson("/api/workspaces/{$workspace->id}/media", ['files' => [$file]])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('files.0');

    $this->assertDatabaseCount('media', 0);
});

it('no longer recognizes mp4/mov as any media type -- video support is fully removed', function () {
    expect(fn () => MediaType::fromExtension('mp4'))->toThrow(InvalidArgumentException::class);
    expect(fn () => MediaType::fromExtension('mov'))->toThrow(InvalidArgumentException::class);
    expect(MediaType::cases())->toHaveCount(3);
});

it('rejects a file that exceeds its type\'s size limit', function () {
    [$workspace, $editor] = mediaWorkspaceWithRole(WorkspaceRole::Editor);

    // Images are capped at 10MB (config/media.php); this one claims 11MB.
    $file = UploadedFile::fake()->create('big.jpg', 11 * 1024, 'image/jpeg');

    $this->actingAs($editor)
        ->postJson("/api/workspaces/{$workspace->id}/media", ['files' => [$file]])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('files.0');
});

it('lists media scoped to the workspace, with search and type filtering', function () {
    [$workspace, $viewer] = mediaWorkspaceWithRole(WorkspaceRole::Viewer);
    Media::factory()->create(['workspace_id' => $workspace->id, 'original_filename' => 'promo-photo.jpg', 'type' => 'image']);
    Media::factory()->create(['workspace_id' => $workspace->id, 'original_filename' => 'press-release.pdf', 'type' => 'document']);
    Media::factory()->create(); // other workspace

    $this->actingAs($viewer)
        ->getJson("/api/workspaces/{$workspace->id}/media")
        ->assertOk()
        ->assertJsonCount(2, 'data');

    $this->actingAs($viewer)
        ->getJson("/api/workspaces/{$workspace->id}/media?type=document")
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.original_filename', 'press-release.pdf');

    $this->actingAs($viewer)
        ->getJson("/api/workspaces/{$workspace->id}/media?search=promo")
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.original_filename', 'promo-photo.jpg');
});

it('renames a media file', function () {
    [$workspace, $editor] = mediaWorkspaceWithRole(WorkspaceRole::Editor);
    $media = Media::factory()->image()->create(['workspace_id' => $workspace->id, 'original_filename' => 'old.jpg']);

    $this->actingAs($editor)
        ->putJson("/api/media/{$media->id}", ['original_filename' => 'new.jpg'])
        ->assertOk()
        ->assertJsonPath('data.original_filename', 'new.jpg');
});

it('keeps the real extension even if the user removes or changes it while renaming', function () {
    [$workspace, $editor] = mediaWorkspaceWithRole(WorkspaceRole::Editor);
    $media = Media::factory()->image()->create(['workspace_id' => $workspace->id, 'original_filename' => 'old.jpg']);

    // Stripped the extension entirely.
    $this->actingAs($editor)
        ->putJson("/api/media/{$media->id}", ['original_filename' => 'no-extension'])
        ->assertOk()
        ->assertJsonPath('data.original_filename', 'no-extension.jpg');

    // Typed a different (wrong) extension.
    $this->actingAs($editor)
        ->putJson("/api/media/{$media->id}", ['original_filename' => 'wrong-ext.pdf'])
        ->assertOk()
        ->assertJsonPath('data.original_filename', 'wrong-ext.jpg');

    // The file on disk — and therefore what actually downloads — is untouched.
    expect($media->fresh()->path)->toBe($media->path);
});

it('still downloads with the correct extension after being renamed without one', function () {
    [$workspace, $editor] = mediaWorkspaceWithRole(WorkspaceRole::Editor);

    $this->actingAs($editor)->postJson("/api/workspaces/{$workspace->id}/media", [
        'files' => [UploadedFile::fake()->image('vacation.jpg')],
    ]);
    $media = Media::first();

    // Reproduces the reported bug: renaming with the extension stripped off.
    $this->actingAs($editor)
        ->putJson("/api/media/{$media->id}", ['original_filename' => 'vacation-photos'])
        ->assertOk();

    $response = $this->actingAs($editor)->get("/api/media/{$media->id}/download");

    $response->assertOk();
    // .webp, not .jpg -- the upload was normalized to WebP, so that's the
    // real extension the rename must fall back to.
    expect($response->headers->get('content-disposition'))->toContain('vacation-photos.webp');
});

it('deletes a media file and removes it from disk', function () {
    [$workspace, $editor] = mediaWorkspaceWithRole(WorkspaceRole::Editor);

    $upload = $this->actingAs($editor)->postJson("/api/workspaces/{$workspace->id}/media", [
        'files' => [UploadedFile::fake()->image('deleteme.jpg')],
    ]);
    $media = Media::first();

    $this->actingAs($editor)->deleteJson("/api/media/{$media->id}")->assertOk();

    $this->assertSoftDeleted('media', ['id' => $media->id]);
    Storage::disk('public')->assertMissing($media->path);
});

it('lets a workspace member download a file', function () {
    [$workspace, $viewer] = mediaWorkspaceWithRole(WorkspaceRole::Viewer);
    Storage::disk('public')->put('workspaces/1/media/document/test.pdf', 'fake pdf content');
    $media = Media::factory()->create([
        'workspace_id' => $workspace->id,
        'path' => 'workspaces/1/media/document/test.pdf',
        'type' => 'document',
        'original_filename' => 'report.pdf',
    ]);

    $response = $this->actingAs($viewer)->get("/api/media/{$media->id}/download");

    $response->assertOk();
    // The actual filename the browser saves, extension included — not just
    // that some Content-Disposition header is present.
    expect($response->headers->get('content-disposition'))->toContain('report.pdf');
});
