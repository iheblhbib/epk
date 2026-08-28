# Storage

## Where files live

`FILESYSTEM_DISK=public` — Laravel's `public` disk, physically `backend/storage/app/public/`, exposed at `{APP_URL}/storage/...` via a symlink from `backend/public/storage` created by `php artisan storage:link`. This needs to be re-run after every fresh deploy (`storage/` and `bootstrap/cache/` aren't typically part of what you'd `git pull`/upload as tracked content in the first place, and the symlink itself isn't portable across environments).

Every upload is stored under a workspace-scoped, type-scoped path:

```
storage/app/public/workspaces/{workspace_id}/media/{image|audio|video|document}/{random-40-chars}.{ext}
storage/app/public/workspaces/{workspace_id}/media/image/{random-40-chars}-thumb.webp   ← image thumbnails only
```

## Filenames are never client-controlled

`MediaUploadService::store()` generates the on-disk filename as `Str::random(40).'.'.$extension` — the client's original filename is preserved only as a separate `original_filename` database column, used purely for display and for the `Content-Disposition` filename on download. This means:

- No path traversal is possible through a crafted filename (`../../etc/passwd`-style names never reach the filesystem).
- No accidental or malicious overwrite of another file (a random 40-char name has no realistic collision chance).
- No "disguised executable" risk from a trusted-looking name — the name on disk carries zero information a filesystem-level exploit could use.

## Content-based validation, not extension-based

`StoreMediaRequest` validates uploads with Laravel's `mimes:` rule, which inspects actual file content via PHP's `fileinfo` extension — not the client-supplied extension or `Content-Type` header. A `.php` file renamed to `photo.jpg` is rejected regardless of what its extension or the browser's reported MIME type claim, because the *content* isn't a real JPEG. The allowed-extension whitelist and per-type size caps both live in `config/media.php`:

```php
'allowed_extensions' => ['jpg', 'jpeg', 'png', 'webp', 'mp3', 'wav', 'flac', 'mp4', 'mov', 'pdf', 'docx'],
'max_size_kb' => ['image' => 10240, 'audio' => 51200, 'video' => 204800, 'document' => 20480],
```

No extension outside that list is accepted — notably no `.svg` (SVGs can carry embedded `<script>` and are a known stored-XSS vector when served back to a browser) and no `.html`/executable types.

## Image thumbnails

Every image upload gets a WebP thumbnail (400px wide, via Intervention Image + GD) generated synchronously at upload time — not queued, for the same reason notifications aren't (see `architecture.md`'s Queues section): no guarantee a queue worker is running on shared hosting. Width/height are captured into `media.metadata` at the same time.

## CSV import/export

Contact CSV import (`ContactCsvImporter`) reads with native `fgetcsv`, validated as `mimes:csv,txt` (a CSV exported from Excel is frequently reported as `text/plain`, hence `txt` being accepted too — content is parsed as CSV regardless of what the extension claims) capped at 2MB. Export streams via `fputcsv` in 200-row chunks rather than loading the whole contact list into memory, and every exported field is escaped against CSV/formula injection — see `security.md`.

## Moving to S3-compatible storage

`config/filesystems.php` already defines an `s3` disk (works with AWS S3 or any S3-compatible provider — Cloudflare R2, Backblaze B2, DigitalOcean Spaces) wired to `AWS_*` env vars, left blank by default. Local disk is the right default for most shared-hosting-scale usage (no extra cost, no extra moving part); switch by setting `FILESYSTEM_DISK=s3` and filling in the `AWS_*` variables once storage needs genuinely outgrow the host's disk quota — no application code change required, since every upload/download path already goes through `Storage::disk($media->disk)` rather than hardcoding `public`.
