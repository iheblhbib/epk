# Architecture

## Overview

This is an EPK (Electronic Press Kit) SaaS platform built as two decoupled applications sharing one repository:

- **`backend/`** — Laravel 12, a pure JSON API. No Blade views, no session-rendered HTML pages (aside from framework-internal ones like password-reset emails). Talks to MySQL, Sanctum-authenticates the SPA, and will later serve the public EPK pages' data via `/api/public/*` routes.
- **`frontend/`** — a Vite + React + TypeScript SPA. Consumes the API over HTTP with cookies (Sanctum SPA auth), builds to 100% static files (`frontend/dist`), and requires **no Node.js runtime in production** — only a static file host.

This split exists because the target deployment is standard shared cPanel hosting, which does not support a persistent Node process. `npm run build` producing static output is the mechanism that keeps the frontend deployable there: build once, upload the static files, done.

## Why not `laravel-vite-plugin` (Blade + React)?

Laravel ships an official Vite integration where Blade views pull in a Vite-built bundle. We deliberately did not use it:

- It couples the two deploy artifacts (Laravel needs the frontend's build manifest to render `<script>` tags), which works against a clean backend/frontend separation.
- A fully decoupled SPA build is a stronger, independently-verifiable guarantee of "no Node runtime needed in production" — `cd frontend && npm run build` succeeding *is* the proof, with zero involvement from the PHP side.
- It keeps the API reusable by future non-web clients (mobile app, third-party integrations) without any HTML-rendering concerns baked into the backend.

The tradeoff is that the SPA and the API are not same-origin by default, so Sanctum's stateful-domain / CORS configuration has to be set up explicitly (see below) — this is a one-time cost, not an ongoing one.

## Deployment topology (target: cPanel)

Recommended: a **subdomain split**, each with its own document root (cPanel subdomains are free/unlimited on shared hosting):

- `epk.karthagopm.com` → document root = `frontend/dist` (static SPA)
- `api.karthagopm.com` → document root = `backend/public` (Laravel)

This avoids needing SPA-fallback rewrite rules inside Laravel's `public/.htaccess`, and gives Sanctum a clean model: `SESSION_DOMAIN=.karthagopm.com` (leading dot) shares the session cookie across both subdomains, and CORS is configured with `supports_credentials => true` and `allowed_origins => ['https://epk.karthagopm.com']`.

**Fallback** if only one domain/subdomain slot is available: copy `frontend/dist/*` into `backend/public/` at deploy time, and add a `Route::fallback()` in Laravel that serves `frontend/dist/index.html` for any non-`/api` path (client-side routing takes over from there). This doesn't require any change to the repo layout above — it's purely a deploy-script decision.

Full step-by-step cPanel instructions are in [`cpanel-deployment.md`](cpanel-deployment.md); this file only fixes the architectural decision so that guide doesn't have to relitigate it.

## Authentication (Sanctum SPA mode)

The frontend is a separate origin from the API in dev (`localhost:5173` vs `localhost:8000`) and in the target production topology (`epk.` vs `api.` subdomains), so Sanctum's **SPA authentication** mode is used — not personal access tokens. Flow:

1. Frontend calls `GET /sanctum/csrf-cookie` once (on app load / before first mutating request) to receive an `XSRF-TOKEN` cookie.
2. Axios automatically echoes that token back as the `X-XSRF-TOKEN` header on subsequent requests (its built-in default behavior when `withCredentials: true`).
3. Laravel's `EnsureFrontendRequestsAreStateful` middleware (enabled via `$middleware->statefulApi()` in `bootstrap/app.php`) recognizes requests from domains listed in `SANCTUM_STATEFUL_DOMAINS` as **stateful** (cookie/session-based) rather than token-based, so `POST /login` sets a normal Laravel session cookie, and subsequent requests are authenticated via that session — no bearer tokens involved for the web SPA.
4. `personal_access_tokens` (Sanctum's other mode) is still migrated and available for a future "API tokens" settings feature, but is not used by the SPA login flow itself.

Session storage: `SESSION_DRIVER=database`, not `file`. On shared hosting with multiple PHP-FPM workers, file-based session locking is a known source of flaky auth under concurrent requests from the same user (e.g. several tabs); a database session driver avoids that class of bug and has no additional infrastructure cost (`sessions` is a plain MySQL table).

## Authorization model

Two independent role systems, both implemented as PHP 8.1+ backed enums on plain `string` database columns (not MySQL `ENUM` columns, and not a general-purpose permissions package):

- **Platform role** (`App\Enums\UserRole`: `user` | `admin`) — on `users.role`. Gates platform-level abilities: every `/api/admin/*` route (see [Admin panel & audit log](#admin-panel--audit-log) below).
- **Workspace role** (`App\Enums\WorkspaceRole`: `owner` | `admin` | `editor` | `viewer`) — on `workspace_members.role`, a per-user-per-workspace pivot value. Gates everything workspace-scoped (EPKs, media, contacts, private links, and more) via `App\Policies\WorkspacePolicy` plus a per-resource policy for each of those (`EpkPolicy`, `MediaPolicy`, `ContactPolicy`, ...), each delegating to the requester's `workspace_members` row.

Why plain strings + PHP enums instead of MySQL `ENUM` columns: adding a new role value to a MySQL `ENUM` requires an `ALTER TABLE ... MODIFY COLUMN`, which can be a table-rewriting operation on large tables. A `VARCHAR` column with a PHP enum cast (`Illuminate\Database\Eloquent\Casts\AsEnumCollection` / native enum casting) gives the same type-safety in application code with zero-cost future additions, validated at the request layer with `Illuminate\Validation\Rule::enum()`.

Why not `spatie/laravel-permission`: that package models roles/permissions as their own tables (`roles`, `permissions`, `model_has_roles`, etc.), which would duplicate what `workspace_members` already expresses for this app's two small, closed role sets. It would be worth reconsidering only if a future requirement needs genuinely dynamic, admin-configurable permission sets rather than the fixed four-role workspace model above.

## API conventions

- All API routes live under `routes/api.php`, prefixed `/api` by Laravel's default routing.
- Every controller returns `Illuminate\Http\Resources\Json\JsonResource` classes (`App\Http\Resources\*`), never raw Eloquent models — this keeps the wire format stable even as models gain internal columns.
- Validation lives in `App\Http\Requests\*` Form Request classes, never inline in controllers.
- The frontend always sends `Accept: application/json`, so Laravel's default exception rendering returns JSON for every error case: `{"message": "...", "errors": {...}}` for 422 validation failures, `{"message": "..."}` for 401/403/404/429. No custom exception renderer exists in Phase 1 — this default shape is the contract later phases should keep relying on.
- Authorization is enforced with Laravel Policies at the controller/route level (`$this->authorize(...)` or `can:` middleware), never inferred client-side. The frontend hides UI for actions a user can't perform, purely as a UX nicety — the backend is the actual authority.

## Admin panel & audit log

`/admin/*` (frontend) and `/api/admin/*` (backend) are gated end to end by `UserRole::Admin`, not a workspace role — a platform admin can act across every workspace, which is exactly what `WorkspacePolicy` is designed to *not* allow for anyone else. The backend gate is a single `EnsureUserIsAdmin` middleware aliased `admin`, applied to the whole route group; the frontend gate is `AdminRoute`, nested inside `ProtectedRoute` so it inherits the loading/auth/verified-email checks rather than re-implementing them (and is tested that way — see `AdminRoute.test.tsx`).

Every moderation action taken through the admin panel (role changes, suspensions, workspace deletion, forced EPK unpublish, plan changes) writes one row to `audit_logs` — actor, action, subject, IP, timestamp — via a small `AuditLogger` service rather than being retrofitted across the whole app. That scoping is deliberate: an audit trail of *admin* actions is a well-defined, testable slice; logging every user action everywhere is a much bigger (and different) feature that would need its own retention/PII strategy.

## Billing architecture

Every workspace has exactly one `subscriptions` row from the moment it's created (`Workspace::booted()`'s `created` hook), defaulting to the Free plan — so nothing downstream ever has to handle "no subscription yet" as a case. The three tiers (Free/Pro/Business) and what each unlocks live in `config/plans.php` as static product data, deliberately not a database table — the same way Stripe's own Price/Product objects aren't edited from inside the app that sells them.

A single `App\Services\PlanLimits` class is the only place that ever answers "can this workspace do X" — EPK count, storage, team members, custom theme overrides, private links — and it's wired into the five controllers that create the thing being limited, not scattered as ad-hoc checks. Two properties worth knowing: limits only block *new* creation (a workspace that's over its limit after a downgrade keeps everything it already has), and `subscriptions.stripe_customer_id`/`stripe_subscription_id`/`current_period_ends_at` exist now but are unused — wiring in real Stripe billing later is a data-backfill against those columns, not a schema change. Until then, plan changes are an admin-only action (`PATCH /admin/workspaces/{workspace}/subscription`).

## Queues, cache, scheduling

- `QUEUE_CONNECTION=database` — no Redis. As it turns out, nothing in the app actually dispatches a queued job as of this writing: every notification (email verification, password reset, workspace invitations) sends **synchronously**, on purpose — a queued job needs a running `php artisan queue:work` worker to ever be delivered, and shared cPanel hosting has no guarantee one is running. Sending synchronously means a deploy with no worker process never silently drops an email. The `jobs`/`job_batches`/`failed_jobs` tables and `QUEUE_CONNECTION` stay migrated/configured for when a genuinely slow operation (bulk export, thumbnail regeneration at scale) makes queuing worth that operational cost — that's a decision to make explicitly later, not a default to fall into.
- `CACHE_STORE=file` — no Redis. Used for exactly one thing today: the admin dashboard's platform-wide stats (`AdminStatsController`), cached 60s to cap a handful of full-table `COUNT`/`SUM` scans. Config/route caching (`php artisan optimize`) uses the same file store at deploy time — see [`cpanel-deployment.md`](cpanel-deployment.md).
- `php artisan schedule:run` needs a single cPanel cron entry once per minute regardless of what's scheduled — but `routes/console.php` doesn't register anything yet. The cron entry is still worth setting up ahead of time (documented in [`cpanel-deployment.md`](cpanel-deployment.md)) since it's inert and free until something needs it.

## Frontend data flow

- **Server state** (anything from the API) lives in TanStack Query — no Redux/Zustand global store. `useQuery`/`useMutation` hooks per resource (`useAuth`, `useWorkspaces`, etc.), colocated under `src/features/<feature>/hooks/`.
- **Auth state** is not a separate context/reducer — it's just `useQuery(['auth', 'user'], getUser)`, so "am I logged in" and "who am I" are always one cache entry, kept fresh by React Query's normal invalidation. A thin `AuthProvider`/`useAuth()` exists purely for ergonomics (avoiding repeating the query key everywhere), not as a second source of truth.
- **Form state** is React Hook Form + Zod resolvers throughout — validation schemas in `src/features/<feature>/schemas/`, shared between form-level and (where useful) unit-testable in isolation.
- **Routing** is `react-router-dom`'s `createBrowserRouter`, with a `ProtectedRoute` layout route gating the authenticated app shell.

## Design system

Original visual identity (Tailwind v4 `@theme` tokens in `frontend/src/styles/globals.css`) — not default Tailwind gray/blue. Near-black/warm-paper neutral scale, an indigo-violet accent color, Space Grotesk for headings, Inter for body text, JetBrains Mono for code/token display. `shadcn/ui` is used purely as a **dev-time code generator** (`npx shadcn add <component>` writes a `.tsx` file into the repo and exits) — it is not a runtime dependency and has no bearing on the "no persistent Node server in production" constraint.

## Related docs

This file covers *why* the system is shaped the way it is. For the specifics:

- [`database.md`](database.md) — every table, what it's for, and the non-obvious schema decisions.
- [`api.md`](api.md) — route map and response conventions.
- [`storage.md`](storage.md) — where uploaded files live and how they're kept safe.
- [`security.md`](security.md) — the standing security posture (this is the Phase 14 hardening pass, written up as a permanent reference rather than a one-time changelog).
- [`cpanel-deployment.md`](cpanel-deployment.md) — shipping it to production.
