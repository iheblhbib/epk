# Database

MySQL 8+ (or MariaDB 10.6+), `utf8mb4`/`utf8mb4_unicode_ci`. Every table uses auto-increment `bigint` primary keys except `epks`, which additionally carries a `uuid` — see [Why `epks` has both an id and a uuid](#why-epks-has-both-an-id-and-a-uuid) below.

Every migration lives in `backend/database/migrations/`, named and dated in build order — that history is more precise than this document for exact column-by-column detail; treat this as the map, the migrations as the source of truth.

## Conventions used throughout

- **Soft deletes** (`deleted_at`) on every table representing user content that's meaningful to recover or audit after deletion: `workspaces`, `epks`, `media`, `artists`, `contacts`. Not on join/log tables (`workspace_members`, `analytics_events`, `audit_logs`) or `subscriptions`, where a row's entire meaning is "the current state," not a history.
- **Roles and statuses are `VARCHAR` + PHP backed enum casts, never MySQL `ENUM` columns.** Adding a new value to a MySQL `ENUM` is an `ALTER TABLE ... MODIFY COLUMN`, potentially a table rewrite on a large table; a plain string column with an `App\Enums\*` cast gets the same type safety in application code (and `Illuminate\Validation\Rule::enum()` at the request layer) with zero migration cost when a new value is added.
- **JSON columns** (`epks.custom_settings`, `epk_sections.config`, `media.metadata`, `analytics_events.meta`, `audit_logs.metadata`) hold genuinely variable-shape or per-type data that would otherwise mean a wide table of mostly-null columns or a proliferation of narrow tables — used for section content config (13 different section types, each with a different shape), theme override axes, image dimensions, and free-form event/audit context respectively. Every JSON column's actual shape is validated at the request layer (a `Http\Requests\*` class), not just "any JSON."
- **Foreign key `onDelete` behavior is chosen deliberately per relationship**, not defaulted to cascade everywhere — see the artists/epks note below for the clearest example.

## Tables

### `users`
Platform accounts. `role` (`user` | `admin`) gates the admin panel; `suspended_at` (nullable timestamp) blocks login when set — checked in `LoginRequest::authenticate()`, not by deleting or otherwise altering the account. `avatar_path` is a reserved column with no upload endpoint wired to it yet.

### `workspaces`
The tenancy boundary — everything else (EPKs, media, contacts, subscriptions) belongs to exactly one workspace. `slug` is globally unique (used nowhere in a public URL today, but kept unique from day one to avoid a painful backfill later). `created_by` is `nullOnDelete`, not `cascadeOnDelete` — deleting the creator's account shouldn't take every workspace they ever created down with it.

### `workspace_members`
A user's (or a not-yet-registered invitee's) membership and role in one workspace. `user_id` is nullable specifically for pending invitations addressed to an email with no account yet; `unique(workspace_id, user_id)` still holds because MySQL treats multiple `NULL`s in a unique index as distinct, so any number of pending (`user_id = NULL`) rows can coexist. `invite_token` carries the pending invitation until accepted, then is cleared. `role` is `owner` | `admin` | `editor` | `viewer` (see `architecture.md`'s authorization section for what each can do).

### `subscriptions`
One row per workspace (`unique(workspace_id)`), created automatically the moment the workspace is (`Workspace::booted()`). `plan` is `free` | `pro` | `business`; what each plan actually allows lives in `config/plans.php`, not this table. `stripe_customer_id`/`stripe_subscription_id`/`current_period_ends_at` are unused today — reserved for when Stripe billing is actually wired up, so that becomes a data-backfill rather than a schema change.

### `artists`
An artist/act profile, scoped to a workspace. One workspace can have several artists (a label managing multiple acts); one artist can have several EPKs (different press kits for different releases/tours).

### `epks`
The press kit itself. `status` is `draft` | `published` | `archived`; only `published` is servable at the public `/epk/{slug}` route. `theme` (one of 5 presets) plus `custom_settings` (JSON, per-axis overrides — background/text/accent color, font, button style, radius, spacing, header style) together resolve to the rendered look, shared by the builder's live preview and the public page through one function (`resolveTheme` in the frontend). `slug` is globally unique and is the public URL.

#### Why `epks` has both an id and a uuid
The `uuid` column exists specifically so a future public-facing reference to an EPK (an API response, an export) never has to expose or imply the sequential auto-increment `id` — enumerable IDs are a mild information leak (`epk #4` tells you 3 others exist) that doesn't matter for `id` (never shown publicly; only `slug` is) but would if some other code path started keying off it. Route binding still uses the auto-increment `id` everywhere today for simplicity; the uuid is forward-looking capacity, not yet load-bearing.

#### Why `artist_id` is `restrictOnDelete`, not `cascadeOnDelete`
Deleting an artist should never silently take their EPKs down with it — that's a much bigger, more surprising blast radius than "delete an artist profile." The `ArtistController` checks for and blocks deletion while EPKs still reference the artist (with a clear error message); the FK constraint is the last-resort safety net if that check is ever bypassed.

### `epk_sections`
One row per section instance on an EPK (Hero, Biography, Photos, Music, Releases, Videos, Press, Events, Social Networks, Contact, Downloads, Credits, Custom — 13 types). `type` + `position` + `is_enabled` are the section's identity/order/visibility; `config` (JSON) holds everything else, and its shape is entirely type-dependent (a Photos section's config is a caption/credit-annotated media list; a Press section's is outlet/quote/link/author/date entries). `PublicSectionConfigResolver` is the one place that turns a section's stored config (bare media ids, raw URLs) into ready-to-render output for the public/private pages.

### `media`
An uploaded file, scoped to a workspace (shared across every EPK/section in that workspace, not owned by one EPK). `filename` is a securely-generated random name — never the client's original filename, which is preserved separately as `original_filename` for display/download purposes only. `type` (`image` | `audio` | `video` | `document`) plus `mime_type` come from **content-based** detection (Laravel's `mimes` validation rule via `fileinfo`), not the client-supplied extension or `Content-Type` header — see [`security.md`](security.md) for why that distinction matters. `thumbnail_path` is set only for images (WebP, generated on upload).

### `contacts`
A workspace's press/industry contact list — journalist, radio, blog, label, booking, management, PR, or other. Independent of `artists`/`epks`; a contact belongs to the workspace as a whole.

### `private_links`
A password-optional, expirable, revocable share link for one EPK — the mechanism that lets a **draft** EPK be shared with a specific person without publishing it. `token` is `Str::random(40)` (64-char column, high-entropy, unguessable by design — unlike `epks.slug`, which is human-chosen and not meant to be secret, this token *is* the entire access control). `password_hash` is bcrypt, nullable. `view_count`/`last_viewed_at` are denormalized onto the row itself for a fast at-a-glance number in the link-management UI, alongside the fuller picture in `analytics_events`.

### `analytics_events`
An append-only event log (`type`: `page_view` | `download` | `audio_play` | `video_play`) for both the public page and private links (`private_link_id` nullable — set only for the latter). `visitor_hash` is `HMAC-SHA256(ip + user agent, app key)` — the raw IP is never stored, and the hash is stable (not date-rotated) so `COUNT(DISTINCT visitor_hash)` over an arbitrary date range is a real unique-visitor count. `country` comes only from a hosting-provided header (Apache `mod_geoip2`'s `GEOIP_COUNTRY_CODE`, or a CDN's `CF-IPCountry`) — this app never makes an outbound geolocation API call, so it's simply `null` when neither header is present, not guessed.

### `audit_logs`
An immutable trail of admin-panel actions — actor, action string (e.g. `user.suspended`, `workspace.deleted_by_admin`), a loose `subject_type`/`subject_id` pair (not a formal polymorphic relation — entries are written once and read back as a flat list, never joined through to the subject), free-form `metadata` JSON, and IP address. No `updated_at` — a log entry is never edited after the fact. Scoped deliberately to admin-panel actions rather than retrofitted across the whole app; see `architecture.md`'s Admin panel section for why.

### `sessions`, `personal_access_tokens`, `jobs`/`job_batches`/`failed_jobs`, `password_reset_tokens`
Framework-standard tables. `sessions` backs `SESSION_DRIVER=database` (chosen over `file` — see `architecture.md`'s Authentication section). `personal_access_tokens` is migrated for Sanctum's other auth mode but unused by the SPA login flow. The `jobs` family exists for `QUEUE_CONNECTION=database` but nothing in the app dispatches a queued job yet (see `architecture.md`'s Queues section) — they're present, not currently load-bearing.

## Entity relationship sketch

```
users ──< workspace_members >── workspaces ──< subscriptions (1:1)
                                     │
                                     ├──< artists ──< epks ──< epk_sections
                                     │                  │
                                     │                  ├──< private_links ──< analytics_events
                                     │                  └──< analytics_events (epk-level)
                                     │
                                     ├──< media
                                     └──< contacts

users ──< audit_logs (actor, nullable)
```
