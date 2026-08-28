# Security

This is the standing security posture — written up as a permanent reference (from the Phase 14 hardening audit), not a changelog of what happened once. If you're adding a new endpoint or feature, check the relevant section here for the pattern to follow.

## Authentication & sessions

Sanctum SPA cookie mode (see `architecture.md`), `SESSION_DRIVER=database`, `SESSION_SECURE_COOKIE=true` in production. Passwords: `Password::defaults()` in `AppServiceProvider` enforces min 8 chars, mixed case, numbers, and symbols server-side — the frontend's live requirements checklist is a UX nicety, this is the actual enforcement, and it can't be bypassed by a client that skips the check. `bcrypt` via `password` cast (`BCRYPT_ROUNDS=12` in production).

A suspended account (`users.suspended_at`) is rejected at the credential-check step in `LoginRequest::authenticate()`, not by deleting or disabling the row some other way — the account and its data stay intact, only the ability to establish a new session is blocked.

## Rate limiting

| Route(s) | Limit |
|---|---|
| `/register` | Named `register` limiter — 5/min per IP |
| `/login` | Named `login` limiter — 5/min per `email+IP` |
| `/forgot-password`, `/reset-password`, `/verify-email/*`, `/email/verification-notification`, `/user/password` | 6/min |
| `/invitations/{token}` (preview), `/invitations/{token}/accept` | 20/min |
| `/invitations/{token}/login`, `/invitations/{token}/register` | 10/min |
| `/workspaces/{workspace}/contacts/import` | 10/min |
| `/workspaces/{workspace}/media` (upload) | 30/min |
| `/private/{token}/verify` | 10/min |
| `/private/{token}`, `/private/{token}/downloads/*` | 60/min |
| `/public/epks/{slug}/events`, `/private/{token}/events` | 120/min |

Every genuinely sensitive or expensive endpoint has a limiter. Admin routes rely on the `admin` role gate rather than an additional rate limit — a compromised admin session is a bigger problem than a rate limit would meaningfully mitigate.

## CSRF

Handled entirely by Sanctum's SPA flow — `GET /sanctum/csrf-cookie` plus axios's built-in `XSRF-TOKEN`/`X-XSRF-TOKEN` cookie handling. No route-level CSRF exemptions exist; nothing to configure per-endpoint.

## XSS

React escapes all interpolated content by default; the only three `dangerouslySetInnerHTML` call sites in the frontend (`sectionRenderers.tsx` ×2, `LivePreview.tsx` ×1) all render rich-text HTML that's sanitized **server-side** before it's ever persisted — `RichTextSanitizer` (HTMLPurifier, the `epk_richtext` profile) runs in `EpkSectionController` on every save of a Biography/Custom section. Raw HTML never round-trips from the client back to the client unfiltered.

If you add a new place that renders stored HTML: reuse `RichTextSanitizer` rather than trusting the input has already been cleaned somewhere upstream.

## SQL injection

Every query goes through Eloquent's query builder (parameterized by default). The few `whereRaw`/`selectRaw` call sites in the codebase either use fixed, hardcoded column-name strings with no user input (`AnalyticsAggregator`'s `selectRaw('DATE(created_at) as date, COUNT(*) as count')` and similar) or parameterized bindings (`WorkspaceMemberController`'s case-insensitive email lookups: `whereRaw('lower(email) = ?', [strtolower($email)])`). Never concatenate a variable into a raw SQL string — always a `?` binding.

## CSV/formula injection

A real vulnerability found and fixed in Phase 14: a contact's `name`/`organization`/`notes` (free text, reachable via the add-contact form or CSV import) starting with `=`, `+`, `-`, or `@` would be evaluated as a live formula the instant the exported CSV opened in Excel or Google Sheets. `ContactController::escapeCsvFormula()` prefixes any such field with a literal `'` before writing it, which every spreadsheet application treats as "this is text" rather than "evaluate this." Covered by a regression test (`ContactTest`). Any future CSV/spreadsheet export in the app should reuse this pattern.

## File uploads

Content-based MIME validation (not extension/`Content-Type` trusted from the client), a closed extension whitelist with no HTML/script-capable types (notably no `.svg`), per-type size caps, and securely random on-disk filenames — see `storage.md` for the full detail. There is currently no upload endpoint at all for the reserved `avatar_path`/`logo_path` columns, so there's no attack surface there to harden.

## Security headers

`App\Http\Middleware\AddSecurityHeaders`, applied globally to every response:

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`

HSTS is deliberately **not** set here — it belongs at the TLS-termination layer (see `cpanel-deployment.md`'s SSL section), not hardcoded in application middleware where it would also apply to a local `php artisan serve` over plain HTTP.

## CORS

`config/cors.php` restricts `allowed_origins` to `FRONTEND_URL` from the environment — never a wildcard — with `supports_credentials => true`. There is no scenario in this app where a wildcard origin with credentials would be correct, and the config makes that mistake structurally hard to reintroduce (there's no `*` anywhere to accidentally leave in).

## Authorization

Every workspace-scoped action is checked against `App\Policies\*` server-side — the frontend hiding a button for a role that can't perform an action is a UX nicety, never the actual enforcement. See `architecture.md`'s Authorization model section for the full role system. Notable hardening in the policies themselves: an owner can never be locked out (removing/demoting the last remaining owner of a workspace is blocked), and the equivalent guard exists for platform admins (`AdminUserController` blocks demoting the last remaining admin, and blocks an admin from changing their own admin/suspension status at all).

## Audit logging

Every admin-panel moderation action (role/suspension changes, workspace deletion, forced EPK unpublish, plan changes) writes an immutable row to `audit_logs` via `App\Services\AuditLogger` — actor, action, subject, IP, timestamp. See `architecture.md`'s Admin panel section and `database.md` for the table itself.

## Privacy: analytics

`analytics_events.visitor_hash` is `HMAC-SHA256(ip + user_agent, app_key)` — the raw IP address is never stored anywhere. Country comes only from a hosting-provided header (never an outbound geolocation API call); if neither `GEOIP_COUNTRY_CODE` nor `CF-IPCountry` is present, the field is simply `null`, not guessed.

## What's explicitly out of scope today

- **HSTS / TLS configuration** — server/hosting-layer, not application code. See `cpanel-deployment.md`.
- **A general-purpose audit trail of non-admin actions** — the current `audit_logs` table is scoped to admin-panel actions specifically; logging every user action across the app is a materially bigger feature (retention policy, PII handling, volume) that hasn't been built.
- **Two-factor authentication** — not yet implemented for any account tier.
- **CI pipeline** — none exists yet (no `.github/workflows` or equivalent); `php artisan test`, `vendor/bin/pint --test`, `npm run test`, `npx tsc -b`, and `npm run lint` are all run manually before considering a phase complete, and should be run the same way before each release. Automated dependency/CVE scanning (`composer audit`, `npm audit`) should likewise be run manually until a CI pipeline exists to do it automatically.
