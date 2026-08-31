# cPanel Deployment Guide

This covers deploying KORAX to standard shared cPanel hosting — no Docker, no root access, no persistent Node process, no Redis. If your host offers something better (a VPS, Laravel Forge, Ploi, etc.), this guide still mostly applies but you have more options than assumed here.

See [`architecture.md`](architecture.md) for *why* the app is split into a static-built `frontend/` and an API-only `backend/` — this doc is the *how*.

## Prerequisites

- **PHP 8.2 or 8.3** with the extensions Laravel 12 needs: `mbstring`, `openssl`, `pdo_mysql`, `tokenizer`, `xml`, `ctype`, `json`, `bcmath`, `fileinfo`, `gd` (for Intervention Image thumbnails). Nearly every cPanel host's "Select PHP Version" tool has all of these as toggles — check `curl`, `gd`, and `fileinfo` are switched on, the rest are usually on by default.
- **MySQL 8+** (or MariaDB 10.6+) — one database, one database user, created via cPanel's "MySQL Databases" tool.
- **Two subdomains** (recommended) or one domain + the single-domain fallback below. cPanel subdomains are free and unlimited on virtually every shared plan.
- **SSH access** if your plan includes it (most mid-tier+ shared plans do) — this guide assumes SSH + Composer are available, since running `composer install` on the server is far simpler than building a vendor bundle locally. If your plan has no SSH, see [No-SSH fallback](#no-ssh-fallback) at the end.
- A way to run `php artisan` commands once deployed — either an SSH session, or cPanel's "Terminal" feature if enabled (functionally the same).

## 1. Topology: subdomain split (recommended)

- `epk.karthagopm.com` → document root **`frontend/dist`** (the static SPA build)
- `api.karthagopm.com` → document root **`backend/public`** (Laravel's public dir, same as any Laravel deploy)

Create both as Subdomains in cPanel (not Addon Domains) pointing at two new, otherwise-empty directories — e.g. `~/epk.karthagopm.com` and `~/api.karthagopm.com` — cPanel creates the document root for you when you create the subdomain.

## 2. Deploy the backend

1. Upload the `backend/` directory's contents to `~/api.karthagopm.com` — everything **except** `vendor/` and `node_modules/` (there is no `node_modules/` in the backend; `vendor/` you'll generate on the server in the next step). Easiest via `git clone`/`git pull` over SSH if your repo is on GitHub/GitLab; otherwise `rsync` or the cPanel File Manager's upload+extract-zip flow both work.
2. SSH in, `cd ~/api.karthagopm.com`, and run:
   ```bash
   composer install --no-dev --optimize-autoloader
   cp .env.example .env
   ```
3. Edit `.env` (cPanel File Manager's editor or `nano`/`vim` over SSH) — see [Environment variables](#environment-variables) below for what every value should be.
4. Generate the app key and finish setup:
   ```bash
   php artisan key:generate
   php artisan migrate --force
   php artisan storage:link
   php artisan optimize
   ```
   `--force` is required because `APP_ENV=production` otherwise refuses to run a migration without confirmation (there's no interactive prompt over a non-interactive deploy). `php artisan optimize` caches config/routes/views/events in one command — re-run it after every deploy that changes code (see [Redeploying](#redeploying-after-the-first-deploy)).
5. Confirm `storage/` and `bootstrap/cache/` are writable by the PHP process (they usually are by default under cPanel's per-account permission model; if not, `chmod -R 775 storage bootstrap/cache`).
6. Sanity check: `curl https://api.karthagopm.com/api/user` should return a `401 Unauthorized` JSON body (not a 500, not raw PHP source, not a blank page) — that's the API correctly up and correctly rejecting an unauthenticated request.

### Environment variables

The checked-in [`backend/.env.example`](../backend/.env.example) already has the production-shaped defaults (`APP_ENV=production`, `APP_DEBUG=false`, `SESSION_DRIVER=database`, `CACHE_STORE=file`, `SESSION_SECURE_COOKIE=true`, etc.) — copy it as the starting point and fill in the environment-specific values:

| Variable | Value |
|---|---|
| `APP_URL` | `https://api.karthagopm.com` |
| `DB_DATABASE` / `DB_USERNAME` / `DB_PASSWORD` | From cPanel's MySQL Databases tool |
| `SESSION_DOMAIN` | `.karthagopm.com` (leading dot — shares the cookie between `epk.` and `api.`) |
| `FRONTEND_URL` | `https://epk.karthagopm.com` |
| `SANCTUM_STATEFUL_DOMAINS` | `epk.karthagopm.com` |
| `MAIL_MAILER` | `smtp` |
| `MAIL_SCHEME` | `smtps` (implicit TLS — required for port 465) |
| `MAIL_HOST` | `epk.karthagopm.com` |
| `MAIL_PORT` | `465` |
| `MAIL_USERNAME` | `no-reply@epk.karthagopm.com` |
| `MAIL_PASSWORD` | The mailbox password (from cPanel's Email Accounts tool) |
| `MAIL_FROM_ADDRESS` | `no-reply@epk.karthagopm.com` |

Leave `AWS_*` blank unless you've decided to move media off local disk onto S3-compatible storage (`FILESYSTEM_DISK=public` — local disk under `storage/app/public` — is the default and is fine for most shared-hosting-scale usage; switch to `s3` only if you outgrow the host's disk quota).

## 3. Deploy the frontend

The frontend needs **zero PHP-side setup** — it's a static build. Build it locally (or in CI), not on the server:

1. On your own machine:
   ```bash
   cd frontend
   cp .env.example .env
   # set VITE_API_URL=https://api.karthagopm.com in frontend/.env
   npm install
   npm run build
   ```
2. Upload the **contents** of `frontend/dist/` (not the `dist` folder itself — its contents) to `~/epk.karthagopm.com`. `dist/.htaccess` (checked into `frontend/public/.htaccess`, copied verbatim into every build — see below) goes up with everything else automatically.
3. Sanity check: visiting `https://epk.karthagopm.com` should show the login page, and `https://epk.karthagopm.com/epks` (typed directly, not clicked to) should also load the SPA rather than an Apache 404 — that second check specifically confirms the `.htaccess` rewrite is in place.

### Why the frontend needs its own `.htaccess`

React Router handles routes like `/epks/5/builder` entirely client-side — there's no real file at that path. A browser refresh, a bookmark, or a shared link hitting that URL directly asks Apache for a file that doesn't exist, so without a rewrite rule Apache 404s it before React Router ever gets a chance to run. [`frontend/public/.htaccess`](../frontend/public/.htaccess) rewrites any request that isn't a real file or directory to `index.html`, and Vite copies everything in `frontend/public/` into `frontend/dist/` unchanged at build time — so every build ships this automatically, nothing extra to remember at deploy time.

## 4. SSL

Almost every cPanel host includes **AutoSSL** (free Let's Encrypt certificates, auto-renewing) — under cPanel → Security → SSL/TLS Status, select both subdomains and run AutoSSL if it hasn't already issued certificates automatically (it usually does this within minutes of a subdomain's DNS resolving). Once both `epk.` and `api.` have valid certs, force HTTPS: cPanel's "Domains" page has a "Force HTTPS Redirect" toggle per (sub)domain — enable it for both rather than hand-writing redirect rules into either `.htaccess`.

## 5. Cron (`schedule:run`)

Laravel's scheduler needs exactly one cron entry, regardless of how many scheduled tasks the app defines — cPanel → Cron Jobs:

```
* * * * * cd /home/youruser/api.karthagopm.com && php artisan schedule:run >> /dev/null 2>&1
```

**As of this phase, `routes/console.php` doesn't register any scheduled tasks** — there's nothing for this cron entry to actually trigger yet (no queued jobs exist anywhere in the app either — every notification sends synchronously specifically so a deploy with no queue worker never silently drops one, see [`WorkspaceInvitationNotification`](../backend/app/Notifications/WorkspaceInvitationNotification.php)). Set up the cron entry anyway; it's inert until something is scheduled and costs nothing to have running. Laravel's database-driven session garbage collection (pruning expired rows from the `sessions` table) already happens automatically via its built-in probabilistic "lottery" on ordinary requests — no cron needed for that specifically.

## 6. Redeploying after the first deploy

**Backend:**
```bash
cd ~/api.karthagopm.com
git pull   # or re-upload changed files
composer install --no-dev --optimize-autoloader   # only if composer.lock changed
php artisan migrate --force                        # only if there are new migrations
php artisan optimize:clear && php artisan optimize  # always — stale route/config cache is a common source of "it works locally" bugs
```

**Frontend:** rebuild locally (`npm run build`) and re-upload `dist/`'s contents, overwriting what's there. Because `index.html` is served with `Cache-Control: no-cache` (set in the `.htaccess` above) while the hashed JS/CSS bundles are cached for a year, a visitor's browser always fetches a fresh `index.html` and therefore always picks up the new bundle references — no manual cache-busting step needed.

## 7. Post-deploy checklist

- [ ] `https://api.karthagopm.com/api/user` → `401` JSON (not a 500 or blank page)
- [ ] `https://api.karthagopm.com/sanctum/csrf-cookie` → `204` with a `Set-Cookie` header
- [ ] `https://epk.karthagopm.com` → login page renders with real styling (not unstyled HTML — confirms the CSS bundle loaded)
- [ ] `https://epk.karthagopm.com/epks` typed directly → loads the SPA, not a 404
- [ ] Register a real account → confirm the verification email actually arrives (tests `MAIL_*`)
- [ ] Log in → create a workspace → create an EPK → confirms DB writes, migrations, and Sanctum's cross-subdomain cookie are all working together
- [ ] Upload a media file → confirms `storage:link` and file permissions
- [ ] Both subdomains show a valid padlock (SSL)

## No-SSH fallback

If your plan genuinely has no SSH or Terminal access (some of the cheapest shared tiers), the backend deploy changes as follows — the frontend deploy is unaffected, since it's just static files uploaded via File Manager/FTP either way:

1. **Build `vendor/` locally**, not on the server: `cd backend && composer install --no-dev --optimize-autoloader`, then upload the whole `backend/` directory including `vendor/` this time.
2. **Running `artisan` commands without a shell** is the real obstacle. Options, roughly best to worst:
   - Check whether your host's cPanel has a "PHP command line" / "Run PHP Script" feature under Software or Advanced — several cPanel builds do, and it runs `artisan` exactly like SSH would.
   - Temporarily add a single locked-down one-time route in `routes/web.php` that shells out to the specific artisan commands you need (`migrate --force`, `key:generate`, `storage:link`), gated by a random secret token in the URL and deleted from the code again immediately after use. This is a real (if inelegant) escape hatch — never leave such a route in place.
   - Ask the host's support to run the three commands for you — many shared-hosting support teams will, since it's a one-time, well-scoped request.
3. Everything else (`.env` setup, SSL, cron, the redeploy process) is identical to the SSH path above.

## Single-domain fallback

If you truly can't get a second subdomain, skip the split above and instead:

1. Build the frontend (`npm run build`) and copy `frontend/dist/*` into `backend/public/` at deploy time (a build step, not a permanent repo change — `backend/public/` stays Laravel's own directory in source control).
2. Add a catch-all fallback route so any URL that isn't `/api/*` or a real static file serves the SPA's `index.html`, letting React Router take over client-side:
   ```php
   // routes/web.php
   Route::fallback(fn () => response()->file(public_path('index.html')));
   ```
3. Set `FRONTEND_URL` and `APP_URL` to the same origin, and drop `SANCTUM_STATEFUL_DOMAINS` to that one domain — same-origin means CORS/stateful-domain configuration gets simpler, not harder.

This works, but the subdomain split stays the recommendation: it keeps the two deploy artifacts (and their very different release cadences — a copy-changes vs. a code-changes-and-migrates deploy) genuinely independent.
