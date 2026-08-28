# API Reference

Base path: `/api` (e.g. `https://api.yourdomain.com/api/login` in production, `http://localhost:8000/api/login` in dev). Every route in this document is defined in `backend/routes/api.php` — that file is the source of truth; this is the organized map of it.

## Conventions

- **Auth**: Sanctum SPA cookie mode, not bearer tokens. Call `GET /sanctum/csrf-cookie` once before the first mutating request, then send requests with `withCredentials: true`; Laravel handles the rest via the session cookie. See `architecture.md`'s Authentication section for the full flow.
- **Response envelope**: a single resource is `{"data": {...}}`; a collection is `{"data": [...]}`. Paginated admin-panel endpoints add `{"data": [...], "meta": {"current_page", "last_page", "total"}}`.
- **Errors**: every error response is JSON (the frontend always sends `Accept: application/json`, so Laravel's default JSON exception rendering applies everywhere — no custom exception renderer). `422` validation failures are `{"message": "...", "errors": {"field": ["..."]}}`; `401`/`403`/`404`/`429` are `{"message": "..."}`.
- **Rate limiting**: noted per route below where it applies. Unnoted authenticated routes have no route-specific limiter beyond whatever the deployment's web server / PHP-FPM pool naturally caps.
- **Authorization**: enforced server-side via Laravel Policies on every route that needs it — never inferred from what the frontend does or doesn't show. A 403 is always a real, intentional denial.

## Auth

| Method | Path | Notes |
|---|---|---|
| POST | `/register` | Throttled. Sends an email verification link. |
| POST | `/login` | Throttled (5/min per email+IP). Rejects a suspended account. |
| POST | `/logout` | Auth required. |
| POST | `/forgot-password` | Throttled. |
| POST | `/reset-password` | Throttled. |
| GET | `/verify-email/{id}/{hash}` | Signed URL, throttled. |
| POST | `/email/verification-notification` | Auth required, throttled. Resend. |
| PUT | `/user/password` | Auth required, throttled. Requires `current_password`. |
| PUT | `/user/profile` | Auth required. Name/email. |
| GET | `/user` | Auth required. The current user. |

## Workspaces & team

| Method | Path | Notes |
|---|---|---|
| GET / POST | `/workspaces` | List the caller's workspaces / create one (creator becomes owner). |
| GET / PUT / DELETE | `/workspaces/{workspace}` | Policy-guarded by role (see `architecture.md`). |
| POST | `/workspaces/{workspace}/leave` | Blocked for a sole owner. |
| GET / POST | `/workspaces/{workspace}/members` | List members (incl. pending invites) / invite by email. |
| PUT / DELETE | `/workspaces/{workspace}/members/{member}` | Change role / remove. Admin-level actors can't touch an owner or another admin. |
| GET | `/invitations/{token}` | Public (no auth), throttled. Preview an invitation — workspace, role, inviter, `invited_email`, `has_account`. The token itself is the access control. |
| POST | `/invitations/{token}/login` | Public, throttled. Log in as the invited (existing) account and accept, in one request. |
| POST | `/invitations/{token}/register` | Public, throttled. Create the account this invite was addressed to (email comes from the invite, not the request body) and accept, in one request. Skips a separate verification email — receiving the invite at that address is already proof of controlling it. |
| POST | `/invitations/{token}/accept` | Auth required, throttled. Accept as whichever account is already signed in. |

## Artists & EPKs

| Method | Path | Notes |
|---|---|---|
| GET / POST | `/workspaces/{workspace}/artists`, `/workspaces/{workspace}/artists` | |
| GET / PUT / DELETE | `/artists/{artist}` | Delete is blocked while any EPK still references the artist. |
| GET | `/epks?workspace_id=` | |
| POST | `/epks` | Blocked once the workspace is at its plan's EPK limit. |
| GET / PUT / DELETE | `/epks/{epk}` | `custom_settings` in the PUT body is blocked unless the plan allows custom themes (picking a `theme` preset is always allowed). |
| POST | `/epks/{epk}/duplicate` | |
| POST | `/epks/{epk}/publish` \| `/unpublish` | |
| GET / POST | `/epks/{epk}/sections` | |
| PUT | `/epks/{epk}/sections/reorder` | |
| PUT / DELETE | `/epks/{epk}/sections/{section}` | |
| POST | `/epks/{epk}/sections/{section}/duplicate` | |

## Media

| Method | Path | Notes |
|---|---|---|
| GET | `/workspaces/{workspace}/media` | `?search=&type=&sort_by=&sort_dir=` |
| POST | `/workspaces/{workspace}/media` | Throttled (30/min). Multipart, `files[]`, up to 20 per request. Blocked if it would exceed the plan's storage limit. |
| PUT | `/media/{media}` | Rename (base name only — extension always comes from the stored file, never the client). |
| DELETE | `/media/{media}` | |
| GET | `/media/{media}/download` | |

## Contacts

| Method | Path | Notes |
|---|---|---|
| GET / POST | `/workspaces/{workspace}/contacts` | `?search=&category=` |
| GET / PUT / DELETE | `/contacts/{contact}` | |
| GET | `/workspaces/{workspace}/contacts/export` | Streamed CSV. Formula-injection-escaped (see `security.md`). |
| POST | `/workspaces/{workspace}/contacts/import` | Throttled (10/min). CSV, header-driven column mapping — refuses to guess if no `name` column is recognized. |

## Analytics

| Method | Path | Notes |
|---|---|---|
| GET | `/epks/{epk}/analytics` | `?from=&to=` (defaults to last 30 days). Totals, daily series, top-8 breakdowns. |

## Private links

| Method | Path | Notes |
|---|---|---|
| GET / POST | `/epks/{epk}/private-links` | Creating one is blocked unless the plan allows private links. |
| PUT / DELETE | `/epks/{epk}/private-links/{privateLink}` | |

## Billing

| Method | Path | Notes |
|---|---|---|
| GET | `/workspaces/{workspace}/billing` | Current plan, usage (EPKs/team members/storage vs. limit), and the full plan comparison table from `config/plans.php`. |

## Admin (`role: admin` only)

Every route below is under `/admin` and requires `auth:sanctum` + the `admin` middleware — a 403 for anyone whose `users.role` isn't `admin`.

| Method | Path | Notes |
|---|---|---|
| GET | `/admin/stats` | Platform-wide totals. Cached 60s. |
| GET | `/admin/users` | `?search=&role=`, paginated. |
| PATCH | `/admin/users/{user}` | `{role?, suspended?}`. An admin can't change their own status; can't demote the platform's only admin. Audit-logged. |
| GET | `/admin/workspaces` | `?search=`, paginated, includes each workspace's plan. |
| DELETE | `/admin/workspaces/{workspace}` | Audit-logged. |
| PATCH | `/admin/workspaces/{workspace}/subscription` | `{plan}`. Manual plan changes until Stripe billing exists. Audit-logged. |
| GET | `/admin/epks` | `?search=&status=`, paginated. |
| POST | `/admin/epks/{epk}/unpublish` | Force-unpublish. Audit-logged. |
| GET | `/admin/audit-logs` | `?action=`, paginated. |

## Public (unauthenticated)

These power `/epk/{slug}` and `/private/{token}` on the frontend — no cookie, no CORS credentials needed.

| Method | Path | Notes |
|---|---|---|
| GET | `/public/epks/{slug}` | 404s for a draft/archived EPK exactly like an unknown slug — never confirms a non-published EPK's existence. |
| GET | `/public/epks/{slug}/downloads/{media}` | |
| POST | `/public/epks/{slug}/events` | Throttled (120/min). Analytics tracking beacon. |
| GET | `/private/{token}` | Throttled (60/min). Works for a **draft** EPK too — that's the point of a private link. |
| POST | `/private/{token}/verify` | Throttled (10/min). Password check; marks the visitor's session on success. |
| GET | `/private/{token}/downloads/{media}` | Throttled (60/min). |
| POST | `/private/{token}/events` | Throttled (120/min). |
