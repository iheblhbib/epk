# Kitfolio

An Electronic Press Kit (EPK) SaaS platform — build, theme, and share professional press kits for artists, labels, and agencies. Built to run on standard shared cPanel hosting (Apache, PHP, MySQL — no Docker, no Redis, no persistent Node server in production).

This repository is at **Phase 16: cPanel Deployment Preparation** — the full product (EPK builder, public/private sharing, analytics, contacts CRM, team management, admin panel, billing architecture, and a security/testing hardening pass) is built; only Phase 17 (final documentation polish) remains. See [ROADMAP.md](ROADMAP.md) for what's built phase-by-phase, [docs/architecture.md](docs/architecture.md) for the technical decisions behind the two-app layout below, and [docs/cpanel-deployment.md](docs/cpanel-deployment.md) for shipping it to production.

```
epk/
├── backend/    Laravel 12 JSON API (MySQL, Sanctum SPA auth)
└── frontend/   React + TypeScript + Vite SPA (builds to static files)
```

## Local development setup (Windows)

### 1. Prerequisites

- **[Laragon](https://laragon.org/)** with **PHP 8.2 or 8.3** selected as the active version, and its bundled MySQL running. (This project was verified against PHP 8.3.33 / MySQL 8.4 via Laragon.)
- **Node.js 20+** and npm (for the frontend build tooling only — no Node process runs in production).
- **Composer 2.x**.

Laragon installs its binaries under `C:\laragon\bin\...` without necessarily adding them to your system `PATH`. If `php -v` or `composer -v` doesn't resolve, either add the relevant `C:\laragon\bin\php\<version>` and `C:\laragon\bin\mysql\<version>\bin` folders to `PATH`, or reference the binaries by their full path.

### 2. Database

Create a dedicated database and a scoped (non-root) user — mirroring how cPanel provisions MySQL accounts:

```sql
CREATE DATABASE epk_dev CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'epk_user'@'localhost' IDENTIFIED BY '<a strong password>';
GRANT ALL PRIVILEGES ON epk_dev.* TO 'epk_user'@'localhost';
FLUSH PRIVILEGES;
```

A second database, `epk_test`, is used by the backend's automated test suite (see `backend/phpunit.xml`) so tests never touch your dev data. Create it the same way and grant the same user access to it.

We deliberately use MySQL for local development rather than SQLite: production is MySQL-only, and later phases rely on MySQL-specific features (JSON columns, FULLTEXT search), so local dev should mirror it exactly.

### 3. Backend (`backend/`)

```bash
cd backend
composer install
cp .env.example .env
php artisan key:generate
```

Edit `.env` — at minimum set `DB_DATABASE`, `DB_USERNAME`, `DB_PASSWORD` to match what you created above, and:

```
APP_URL=http://localhost:8000
FRONTEND_URL=http://localhost:5173
SANCTUM_STATEFUL_DOMAINS=localhost:5173,127.0.0.1:5173
SESSION_DOMAIN=localhost
SESSION_SECURE_COOKIE=false
```

Then:

```bash
php artisan migrate --seed
php artisan storage:link
php artisan serve
```

The API is now running at `http://localhost:8000`. `storage:link` uses PHP's `symlink()` — on Windows this needs either **Developer Mode** enabled (Settings → Update & Security → For Developers) or an elevated terminal; it works without any special privileges on cPanel/Linux.

The seeder creates a demo login: **demo@kitfolio.test** / **password**, already a member of a seeded "Kitfolio Demo" workspace (as owner), with a second teammate and one pending invitation — so the dashboard isn't empty on first login.

### 4. Frontend (`frontend/`)

```bash
cd frontend
npm install
cp .env.example .env   # VITE_API_URL defaults to http://localhost:8000, which matches the backend above
npm run dev
```

The app is now running at `http://localhost:5173`.

### 5. Verify everything works

Backend:

```bash
cd backend
php artisan test        # or vendor/bin/pest
vendor/bin/pint --test  # code style
php artisan route:list  # sanity check
```

Frontend:

```bash
cd frontend
npm run build   # proves the app is deployable as static files only — no Node runtime needed
npm run test
npx tsc -b
npm run lint
```

Manual smoke test: register a new account → click the verification link (printed to `backend/storage/logs/laravel.log`, since `MAIL_MAILER=log` in dev) → sign in → create a workspace → invite a teammate → check role-based permissions on the Team page.

## Tech stack

- **Backend**: PHP 8.2+, Laravel 12, MySQL, Laravel Sanctum (SPA cookie auth), Eloquent, Policies, database-driven queues and file-based cache (no Redis), Pest for testing.
- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4, shadcn/ui, React Router, TanStack Query, React Hook Form + Zod, Vitest + Testing Library.

Full reasoning for these choices — especially the decoupled backend/frontend split and how it maps onto cPanel deployment — is in [docs/architecture.md](docs/architecture.md).

## Documentation

- [ROADMAP.md](ROADMAP.md) — the 17-phase build plan and what's done so far.
- [docs/architecture.md](docs/architecture.md) — system architecture, auth model, authorization design, API conventions.
- [docs/cpanel-deployment.md](docs/cpanel-deployment.md) — step-by-step production deployment: subdomain topology, `.env` setup, SSL, cron, and the redeploy process.

The rest of the `docs/` set (database, API reference, storage, security) lands in Phase 17.
