# Workspace Dashboard — Real Data & Activity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the workspace Dashboard's two hardcoded `'0'` stats with real data, add a workspace-wide trend chart, a top-performing-EPK callout, and a recent-activity feed.

**Architecture:** Extend the existing per-EPK `AnalyticsAggregator`/`AnalyticsController` with a workspace-scoped sibling method+route returning the identical response shape (so the frontend reuses `PageViewsChart` unchanged). Extend the existing `notifications` table query (already carries `workspace_id` per row) with an optional filter, and extract the existing `NotificationRow` rendering out of `NotificationBell.tsx` so the new Dashboard feed reuses it exactly.

**Tech Stack:** Laravel 12 / Pest (backend), React + TypeScript + Vitest + MSW (frontend). No new tables, no new dependencies.

**Spec:** [docs/superpowers/specs/2026-09-11-workspace-dashboard-design.md](../specs/2026-09-11-workspace-dashboard-design.md)

## Global Constraints

- Every new/changed PHP file must pass `vendor/bin/pint --test app/ tests/ routes/` before a task is considered done (autofix with `vendor/bin/pint <files>` first).
- Every new/changed TS/TSX file must pass `npx tsc -b --noEmit` and `npx oxlint <files>`.
- No new database migrations in this plan — everything reuses existing tables (`analytics_events`, `notifications`).
- i18n edits touch all 7 locale files (`frontend/src/i18n/locales/{en,fr,es,pt,de,ar,zh}.json`), which are hand-formatted with CRLF line endings — edit them with a small Node script doing a targeted string replace anchored on a stable, unique surrounding string (verify uniqueness with a grep/count before replacing), never with `JSON.stringify` (which reformats the whole file). Validate every edited file with `JSON.parse` afterward.
- Confirmed during planning (no implementation-time investigation needed): all 9 database-channel notification classes (`DraftEpkReminderNotification`, `EpkPublishedNotification`, `InvitationAcceptedNotification`, `MemberRoleChangedNotification`, `PrivateLinkOpenedNotification`, `TeamMemberJoinedNotification`, `ViewMilestoneNotification`, `WeeklyDigestNotification`, `WorkspaceInvitationNotification`) store `workspace_id` as a plain integer (`$workspace->id` / `$this->epk->workspace_id` etc.) — consistent typing, no normalization needed.
- `AnalyticsQueryRequest::authorize()` currently reads `$this->route('epk')` only — this must be generalized (Task 1) before the new workspace route will work; a request against the new route would otherwise 403 for everyone, including the workspace owner.
- Frontend hooks that purely delegate to an API-client function (no branching logic of their own) are exercised through the page/component test that consumes them, not an isolated hook test file — matching this codebase's existing pattern (e.g. `useBilling`, `useCreatePortalSession` have no standalone test file; they're covered via `BillingPage.test.tsx`). Do not write isolated hook unit tests for `useWorkspaceAnalytics` / `useWorkspaceActivity`.

---

### Task 1: Backend — workspace-wide analytics endpoint

**Files:**
- Modify: `backend/app/Http/Requests/AnalyticsQueryRequest.php`
- Modify: `backend/app/Services/AnalyticsAggregator.php`
- Modify: `backend/app/Http/Controllers/Api/AnalyticsController.php`
- Modify: `backend/routes/api.php`
- Test: `backend/tests/Feature/Analytics/AnalyticsTest.php` (extend existing file)

**Interfaces:**
- Produces: `AnalyticsAggregator::summarizeForWorkspace(Workspace $workspace, CarbonInterface $from, CarbonInterface $to): array` — same keys as the existing `summarize()` (`totals`, `daily_page_views`, `top_referrers`, `top_countries`, `devices`, `top_downloads`, `top_private_links`) plus one new key `top_epk: array{id: int, title: string, views: int}|null`.
- Produces: `GET /api/workspaces/{workspace}/analytics` (optional `from`/`to` query params, same validation as the per-EPK route) → `{"data": {"from": ..., "to": ..., ...summarizeForWorkspace() keys}}`.

- [ ] **Step 1: Write the failing tests**

Append to `backend/tests/Feature/Analytics/AnalyticsTest.php` (the file already has `analyticsWorkspaceWithMember()` and `publishedEpkFor()` helpers — reuse them):

```php
// --- Workspace-wide aggregation ---

it('denies workspace analytics to a non-member', function () {
    [$workspace] = analyticsWorkspaceWithMember(WorkspaceRole::Owner);
    $outsider = User::factory()->create();

    $this->actingAs($outsider)->getJson("/api/workspaces/{$workspace->id}/analytics")->assertForbidden();
});

it('aggregates page views across every epk in the workspace', function () {
    [$workspace, $owner] = analyticsWorkspaceWithMember(WorkspaceRole::Owner);
    $epkA = publishedEpkFor($workspace);
    $epkB = publishedEpkFor($workspace);

    AnalyticsEvent::factory()->for($epkA)->type(AnalyticsEventType::PageView)->count(2)->create();
    AnalyticsEvent::factory()->for($epkB)->type(AnalyticsEventType::PageView)->count(3)->create();

    $response = $this->actingAs($owner)->getJson("/api/workspaces/{$workspace->id}/analytics");

    $response->assertOk();
    $response->assertJsonPath('data.totals.page_views', 5);
});

it('names the epk with the most views as top_epk', function () {
    [$workspace, $owner] = analyticsWorkspaceWithMember(WorkspaceRole::Owner);
    $epkA = publishedEpkFor($workspace);
    $epkB = publishedEpkFor($workspace);

    AnalyticsEvent::factory()->for($epkA)->type(AnalyticsEventType::PageView)->count(1)->create();
    AnalyticsEvent::factory()->for($epkB)->type(AnalyticsEventType::PageView)->count(4)->create();

    $response = $this->actingAs($owner)->getJson("/api/workspaces/{$workspace->id}/analytics");

    $response->assertOk();
    $response->assertJsonPath('data.top_epk.id', $epkB->id);
    $response->assertJsonPath('data.top_epk.title', $epkB->title);
    $response->assertJsonPath('data.top_epk.views', 4);
});

it('returns a null top_epk and all-zero totals when the workspace has no page views yet', function () {
    [$workspace, $owner] = analyticsWorkspaceWithMember(WorkspaceRole::Owner);
    publishedEpkFor($workspace);

    $response = $this->actingAs($owner)->getJson("/api/workspaces/{$workspace->id}/analytics");

    $response->assertOk();
    $response->assertJsonPath('data.top_epk', null);
    $response->assertJsonPath('data.totals.page_views', 0);
});

it('returns all-zero totals for a workspace with no epks at all', function () {
    [$workspace, $owner] = analyticsWorkspaceWithMember(WorkspaceRole::Owner);

    $response = $this->actingAs($owner)->getJson("/api/workspaces/{$workspace->id}/analytics");

    $response->assertOk();
    $response->assertJsonPath('data.totals.page_views', 0);
    $response->assertJsonPath('data.daily_page_views', []);
    $response->assertJsonPath('data.top_epk', null);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd backend && php vendor/bin/pest tests/Feature/Analytics/AnalyticsTest.php -v`
Expected: the 5 new tests FAIL — the first four with a 404 (route doesn't exist yet), the "no epks at all" one likewise.

- [ ] **Step 3: Fix `AnalyticsQueryRequest::authorize()` to work for both routes**

In `backend/app/Http/Requests/AnalyticsQueryRequest.php`, replace:

```php
public function authorize(): bool
{
    return $this->user()->can('view', $this->route('epk'));
}
```

with:

```php
public function authorize(): bool
{
    // Bound to whichever route this request is used on -- the per-EPK
    // analytics route (`epk` param) or the workspace-wide one
    // (`workspace` param). Exactly one of these is present depending on
    // which route matched.
    $subject = $this->route('epk') ?? $this->route('workspace');

    return $subject !== null && $this->user()->can('view', $subject);
}
```

- [ ] **Step 4: Add `summarizeForWorkspace` to `AnalyticsAggregator`**

In `backend/app/Services/AnalyticsAggregator.php`, add this method to the class (add `use App\Models\Workspace;` to the imports at the top of the file):

```php
/**
 * Same shape as summarize(), scoped across every EPK in the workspace
 * instead of one -- powers the workspace Dashboard. Plus one addition,
 * top_epk, which summarize() has no use for (it's already scoped to a
 * single EPK).
 *
 * @return array<string, mixed>
 */
public function summarizeForWorkspace(Workspace $workspace, CarbonInterface $from, CarbonInterface $to): array
{
    $epks = $workspace->epks()->get(['id', 'title']);
    $epkIds = $epks->pluck('id');

    $base = fn () => AnalyticsEvent::query()->toBase()
        ->whereIn('analytics_events.epk_id', $epkIds)
        ->whereBetween('analytics_events.created_at', [$from, $to]);

    $totals = [
        'page_views' => (clone $base())->where('type', AnalyticsEventType::PageView->value)->count(),
        'unique_visitors' => (clone $base())->distinct()->count('visitor_hash'),
        'downloads' => (clone $base())->where('type', AnalyticsEventType::Download->value)->count(),
        'audio_plays' => (clone $base())->where('type', AnalyticsEventType::AudioPlay->value)->count(),
        'video_plays' => (clone $base())->where('type', AnalyticsEventType::VideoPlay->value)->count(),
    ];

    $dailyPageViews = (clone $base())
        ->where('type', AnalyticsEventType::PageView->value)
        ->selectRaw('DATE(created_at) as date, COUNT(*) as count')
        ->groupBy('date')
        ->orderBy('date')
        ->get()
        ->map(fn ($row) => ['date' => (string) $row->date, 'count' => (int) $row->count])
        ->all();

    $topReferrers = (clone $base())
        ->whereNotNull('referrer_host')
        ->selectRaw('referrer_host as referrer, COUNT(*) as count')
        ->groupBy('referrer_host')
        ->orderByDesc('count')
        ->limit(8)
        ->get()
        ->map(fn ($row) => ['referrer' => $row->referrer, 'count' => (int) $row->count])
        ->all();

    $topCountries = (clone $base())
        ->whereNotNull('country')
        ->selectRaw('country, COUNT(*) as count')
        ->groupBy('country')
        ->orderByDesc('count')
        ->limit(8)
        ->get()
        ->map(fn ($row) => ['country' => $row->country, 'count' => (int) $row->count])
        ->all();

    $devices = (clone $base())
        ->whereNotNull('device_type')
        ->selectRaw('device_type, COUNT(*) as count')
        ->groupBy('device_type')
        ->orderByDesc('count')
        ->get()
        ->map(fn ($row) => ['device_type' => $row->device_type, 'count' => (int) $row->count])
        ->all();

    $topDownloads = (clone $base())
        ->where('type', AnalyticsEventType::Download->value)
        ->whereNotNull('meta')
        ->get(['meta'])
        ->map(fn ($row) => json_decode((string) $row->meta, true)['filename'] ?? null)
        ->filter()
        ->countBy()
        ->sortDesc()
        ->take(8)
        ->map(fn ($count, $filename) => ['filename' => $filename, 'count' => $count])
        ->values()
        ->all();

    $topPrivateLinks = (clone $base())
        ->whereNotNull('private_link_id')
        ->join('private_links', 'private_links.id', '=', 'analytics_events.private_link_id')
        ->selectRaw('COALESCE(private_links.label, private_links.token) as label, COUNT(*) as count')
        ->groupBy('private_links.id', 'private_links.label', 'private_links.token')
        ->orderByDesc('count')
        ->limit(8)
        ->get()
        ->map(fn ($row) => ['label' => $row->label, 'count' => (int) $row->count])
        ->all();

    $topEpkRow = (clone $base())
        ->where('type', AnalyticsEventType::PageView->value)
        ->selectRaw('epk_id, COUNT(*) as views')
        ->groupBy('epk_id')
        ->orderByDesc('views')
        ->first();

    $topEpk = $topEpkRow
        ? [
            'id' => (int) $topEpkRow->epk_id,
            'title' => (string) $epks->firstWhere('id', $topEpkRow->epk_id)?->title,
            'views' => (int) $topEpkRow->views,
        ]
        : null;

    return [
        'totals' => $totals,
        'daily_page_views' => $dailyPageViews,
        'top_referrers' => $topReferrers,
        'top_countries' => $topCountries,
        'devices' => $devices,
        'top_downloads' => $topDownloads,
        'top_private_links' => $topPrivateLinks,
        'top_epk' => $topEpk,
    ];
}
```

- [ ] **Step 5: Add `forWorkspace` to `AnalyticsController`**

In `backend/app/Http/Controllers/Api/AnalyticsController.php`, add `use App\Models\Workspace;` to the imports, then add this method to the class:

```php
public function forWorkspace(AnalyticsQueryRequest $request, Workspace $workspace): JsonResponse
{
    $to = $request->validated('to')
        ? Carbon::parse($request->validated('to'))->endOfDay()
        : now()->endOfDay();

    $from = $request->validated('from')
        ? Carbon::parse($request->validated('from'))->startOfDay()
        : $to->copy()->subDays(29)->startOfDay();

    return response()->json([
        'data' => [
            'from' => $from->toDateString(),
            'to' => $to->toDateString(),
            ...$this->aggregator->summarizeForWorkspace($workspace, $from, $to),
        ],
    ]);
}
```

- [ ] **Step 6: Add the route**

In `backend/routes/api.php`, insert immediately before the existing `Route::get('/workspaces/{workspace}/contacts', ...)` line (around line 222):

```php
    Route::get('/workspaces/{workspace}/analytics', [AnalyticsController::class, 'forWorkspace']);

```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `cd backend && php vendor/bin/pest tests/Feature/Analytics/AnalyticsTest.php -v`
Expected: all tests in the file PASS (both the pre-existing per-EPK ones and the 5 new ones).

- [ ] **Step 8: Pint**

Run: `cd backend && vendor/bin/pint app/Http/Requests/AnalyticsQueryRequest.php app/Services/AnalyticsAggregator.php app/Http/Controllers/Api/AnalyticsController.php routes/api.php tests/Feature/Analytics/AnalyticsTest.php`
Then: `vendor/bin/pint --test app/ tests/ routes/` to confirm clean.

- [ ] **Step 9: Commit**

```bash
git add backend/app/Http/Requests/AnalyticsQueryRequest.php backend/app/Services/AnalyticsAggregator.php backend/app/Http/Controllers/Api/AnalyticsController.php backend/routes/api.php backend/tests/Feature/Analytics/AnalyticsTest.php
git commit -m "Add workspace-wide analytics endpoint for the Dashboard"
```

---

### Task 2: Backend — filter notifications by workspace

**Files:**
- Modify: `backend/app/Http/Controllers/Api/NotificationController.php`
- Test: `backend/tests/Feature/Notifications/NotificationTest.php` (extend existing file)

**Interfaces:**
- Produces: `GET /api/notifications?workspace_id={id}` — same response shape as today (`NotificationResource::collection(...)->response()`), filtered to notifications whose JSON payload `workspace_id` matches. Omitting the param keeps today's unfiltered behavior exactly.

- [ ] **Step 1: Write the failing test**

Append to `backend/tests/Feature/Notifications/NotificationTest.php` (reuses the file's existing `makeWorkspaceWithOwnerForNotifications()` helper):

```php
it('filters notifications to a single workspace when workspace_id is given', function () {
    [$workspaceA, $owner] = makeWorkspaceWithOwnerForNotifications();
    $workspaceB = Workspace::factory()->create(['created_by' => $owner->id]);
    $workspaceB->members()->create(['user_id' => $owner->id, 'role' => WorkspaceRole::Owner, 'status' => 'active', 'joined_at' => now()]);
    $invitee = User::factory()->create(['email' => 'invitee@example.com']);

    $this->actingAs($owner)->postJson("/api/workspaces/{$workspaceA->id}/members", [
        'email' => 'invitee@example.com',
        'role' => WorkspaceRole::Editor->value,
    ])->assertCreated();
    $this->actingAs($owner)->postJson("/api/workspaces/{$workspaceB->id}/members", [
        'email' => 'invitee@example.com',
        'role' => WorkspaceRole::Viewer->value,
    ])->assertCreated();

    $this->actingAs($invitee)->getJson('/api/notifications')
        ->assertOk()
        ->assertJsonCount(2, 'data');

    $this->actingAs($invitee)->getJson("/api/notifications?workspace_id={$workspaceA->id}")
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.payload.workspace_id', $workspaceA->id);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && php vendor/bin/pest tests/Feature/Notifications/NotificationTest.php -v`
Expected: FAIL — the filtered request currently returns both notifications (2), not 1.

- [ ] **Step 3: Implement the filter**

In `backend/app/Http/Controllers/Api/NotificationController.php`, replace:

```php
public function index(Request $request): JsonResponse
{
    $notifications = $request->user()->notifications()->paginate(15);

    return NotificationResource::collection($notifications)->response();
}
```

with:

```php
public function index(Request $request): JsonResponse
{
    $query = $request->user()->notifications();

    if ($request->filled('workspace_id')) {
        $query->where('data->workspace_id', $request->integer('workspace_id'));
    }

    $notifications = $query->paginate(15);

    return NotificationResource::collection($notifications)->response();
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd backend && php vendor/bin/pest tests/Feature/Notifications/NotificationTest.php -v`
Expected: PASS — all tests in the file green, including the new one and the pre-existing `"lists only the authenticated user's own notifications"` (unfiltered) one.

- [ ] **Step 5: Pint**

Run: `cd backend && vendor/bin/pint app/Http/Controllers/Api/NotificationController.php tests/Feature/Notifications/NotificationTest.php`
Then: `vendor/bin/pint --test app/ tests/` to confirm clean.

- [ ] **Step 6: Commit**

```bash
git add backend/app/Http/Controllers/Api/NotificationController.php backend/tests/Feature/Notifications/NotificationTest.php
git commit -m "Add an optional workspace_id filter to GET /notifications"
```

---

### Task 3: Frontend — extract `NotificationRow` for reuse

Pure refactor: no new behavior, so no new failing test is written first (per the TDD skill's REFACTOR phase — stay green, don't add behavior). The existing `NotificationBell.test.tsx` already exercises the row-rendering logic being moved; it must stay green before and after.

**Files:**
- Create: `frontend/src/components/common/NotificationRow.tsx`
- Modify: `frontend/src/components/common/NotificationBell.tsx`
- Test: `frontend/src/components/common/NotificationBell.test.tsx` (unchanged — regression check only)

**Interfaces:**
- Produces: `NotificationRow` (component, matches the codebase's named-export convention: `export function NotificationRow({ notification }: { notification: AppNotification })`) and `NotificationRowShell` (also exported, in case a future consumer needs the shell without the kind-switch), both from the new file. Consumed by Task 4's `DashboardActivityFeed`.

- [ ] **Step 1: Run the existing test to confirm the baseline is green**

Run: `cd frontend && npx vitest run src/components/common/NotificationBell.test.tsx`
Expected: PASS (all 5 existing tests).

- [ ] **Step 2: Create `NotificationRow.tsx`**

Move `NotificationRowShell` and `NotificationRow` — the two functions currently declared in `NotificationBell.tsx` between the imports and the `NotificationBell` component itself (everything from `function NotificationRowShell(...)` through the end of the `NotificationRow` function's closing brace, i.e. today's lines 28–251) — into a new file `frontend/src/components/common/NotificationRow.tsx`. Both functions get `export` added (`NotificationRowShell` didn't have it before, since it was only used internally by `NotificationRow` in the same file). The new file's imports are exactly the subset of `NotificationBell.tsx`'s current imports that these two functions actually use:

```typescript
import { BarChart3, Eye, FileText, ShieldAlert, Sparkles, TrendingUp, UserCheck, UserPlus, Users } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { useMarkNotificationAsRead } from '@/features/notifications/hooks/useNotifications'
import { formatRelativeTime } from '@/lib/relativeTime'
import { cn } from '@/lib/utils'
import type { AppNotification } from '@/types'

// ...NotificationRowShell and NotificationRow, moved verbatim from
// NotificationBell.tsx, both now `export function` instead of `function`.
```

- [ ] **Step 3: Update `NotificationBell.tsx`**

Remove the now-moved `NotificationRowShell`/`NotificationRow` function bodies, drop the imports that only they used (`BarChart3, Eye, FileText, ShieldAlert, Sparkles, TrendingUp, UserCheck, UserPlus, Users` from `lucide-react`; `ReactNode`; `Link`; `useMarkNotificationAsRead`; `formatRelativeTime`; `cn`; `AppNotification` — keep whichever of these `NotificationBell` itself still needs, e.g. `Bell`, `Loader2` from `lucide-react` stay), and add:

```typescript
import { NotificationRow } from '@/components/common/NotificationRow'
```

`NotificationBell`'s own body (the `export function NotificationBell()` at the bottom) is otherwise unchanged — it already calls `<NotificationRow key={notification.id} notification={notification} />`, which now resolves to the imported component instead of the local one.

- [ ] **Step 4: Run the test again to confirm it's still green**

Run: `cd frontend && npx vitest run src/components/common/NotificationBell.test.tsx`
Expected: PASS — identical result to Step 1. If anything fails, the extraction changed behavior; fix the extraction, don't change the test.

- [ ] **Step 5: Typecheck and lint**

Run: `cd frontend && npx tsc -b --noEmit && npx oxlint src/components/common/NotificationRow.tsx src/components/common/NotificationBell.tsx`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/common/NotificationRow.tsx frontend/src/components/common/NotificationBell.tsx
git commit -m "Extract NotificationRow out of NotificationBell for reuse on the Dashboard"
```

---

### Task 4: Frontend — wire the Dashboard to real data + activity feed

**Files:**
- Modify: `frontend/src/types/index.ts`
- Modify: `frontend/src/api/analytics.ts`
- Modify: `frontend/src/features/analytics/hooks/useAnalytics.ts`
- Modify: `frontend/src/api/notifications.ts`
- Modify: `frontend/src/features/notifications/hooks/useNotifications.ts`
- Create: `frontend/src/features/dashboard/components/DashboardActivityFeed.tsx`
- Create: `frontend/src/features/dashboard/components/TopEpkCard.tsx`
- Modify: `frontend/src/pages/DashboardHome.tsx`
- Modify: `frontend/src/i18n/locales/{en,fr,es,pt,de,ar,zh}.json`
- Test: `frontend/src/pages/DashboardHome.test.tsx` (new)

**Interfaces:**
- Consumes: `GET /api/workspaces/{id}/analytics` (Task 1), `GET /api/notifications?workspace_id={id}` (Task 2), `NotificationRow` (Task 3).
- Produces: `getWorkspaceAnalytics(workspaceId, range?): Promise<AnalyticsSummary>`, `useWorkspaceAnalytics(workspaceId): UseQueryResult<AnalyticsSummary>`, `listNotifications(page, workspaceId?): Promise<ApiPaginated<AppNotification>>` (signature change — see Step 6), `useWorkspaceActivity(workspaceId): UseQueryResult<ApiPaginated<AppNotification>>`.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/pages/DashboardHome.test.tsx`:

```typescript
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { DashboardHome } from '@/pages/DashboardHome'
import { server } from '@/test/server'
import type { AppNotification } from '@/types'

const API_URL = 'http://localhost:8000'

const workspace = {
  id: 1,
  name: 'Acme Records',
  slug: 'acme-records',
  description: null,
  logo_url: null,
  my_role: 'owner',
  members_count: 1,
  created_at: '2026-01-01T00:00:00.000000Z',
  updated_at: '2026-01-01T00:00:00.000000Z',
}

const epk = {
  id: 7,
  title: 'Summer Tour EPK',
  status: 'published',
  slug: 'summer-tour',
  workspace_id: 1,
  artist_id: 1,
  created_at: '2026-01-01T00:00:00.000000Z',
  updated_at: '2026-01-01T00:00:00.000000Z',
}

function analyticsResponse(overrides: Record<string, unknown> = {}) {
  return {
    data: {
      from: '2026-08-12',
      to: '2026-09-10',
      totals: { page_views: 42, unique_visitors: 30, downloads: 5, audio_plays: 0, video_plays: 0 },
      daily_page_views: [{ date: '2026-09-10', count: 42 }],
      top_referrers: [],
      top_countries: [],
      devices: [],
      top_downloads: [],
      top_private_links: [],
      top_epk: { id: 7, title: 'Summer Tour EPK', views: 42 },
      ...overrides,
    },
  }
}

function activityResponse(notifications: AppNotification[] = []) {
  return { data: notifications, meta: { current_page: 1, last_page: 1, total: notifications.length } }
}

function mockBaseline() {
  server.use(
    http.get(`${API_URL}/api/workspaces`, () => HttpResponse.json({ data: [workspace] })),
    http.get(`${API_URL}/api/epks`, () => HttpResponse.json({ data: [epk] }))
  )
}

function renderDashboard() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <DashboardHome />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('DashboardHome', () => {
  it('shows real total views and downloads instead of the old hardcoded zeros', async () => {
    mockBaseline()
    server.use(
      http.get(`${API_URL}/api/workspaces/:id/analytics`, () => HttpResponse.json(analyticsResponse())),
      http.get(`${API_URL}/api/notifications`, () => HttpResponse.json(activityResponse()))
    )

    renderDashboard()

    expect(await screen.findByText('42')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
  })

  it('shows the top-performing EPK callout when one exists', async () => {
    mockBaseline()
    server.use(
      http.get(`${API_URL}/api/workspaces/:id/analytics`, () => HttpResponse.json(analyticsResponse())),
      http.get(`${API_URL}/api/notifications`, () => HttpResponse.json(activityResponse()))
    )

    renderDashboard()

    expect(await screen.findByText('Summer Tour EPK')).toBeInTheDocument()
  })

  it('hides the top-performing EPK callout when there is no traffic yet', async () => {
    mockBaseline()
    server.use(
      http.get(`${API_URL}/api/workspaces/:id/analytics`, () =>
        HttpResponse.json(analyticsResponse({ top_epk: null }))
      ),
      http.get(`${API_URL}/api/notifications`, () => HttpResponse.json(activityResponse()))
    )

    renderDashboard()

    await screen.findByText('42') // wait for load
    expect(screen.queryByText('Summer Tour EPK')).not.toBeInTheDocument()
  })

  it('shows recent activity notifications for this workspace', async () => {
    mockBaseline()
    const notification: AppNotification = {
      id: 'a1b2c3d4-0000-0000-0000-000000000001',
      kind: 'view_milestone',
      payload: { kind: 'view_milestone', epk_id: 7, epk_title: 'Summer Tour EPK', workspace_id: 1, milestone: 1000 },
      read_at: null,
      created_at: new Date().toISOString(),
    }
    server.use(
      http.get(`${API_URL}/api/workspaces/:id/analytics`, () => HttpResponse.json(analyticsResponse())),
      http.get(`${API_URL}/api/notifications`, () => HttpResponse.json(activityResponse([notification])))
    )

    renderDashboard()

    // i18next's default interpolation does no thousands-grouping (no
    // custom number formatter is registered in src/i18n/index.ts), so
    // {{count}} in viewMilestoneBlurb renders the raw number, "1000", not
    // "1,000".
    expect(await screen.findByText(/1000/)).toBeInTheDocument()
  })

  it('shows an empty state when there is no recent activity', async () => {
    mockBaseline()
    server.use(
      http.get(`${API_URL}/api/workspaces/:id/analytics`, () => HttpResponse.json(analyticsResponse())),
      http.get(`${API_URL}/api/notifications`, () => HttpResponse.json(activityResponse()))
    )

    renderDashboard()

    expect(await screen.findByText('No recent activity yet.')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npx vitest run src/pages/DashboardHome.test.tsx`
Expected: FAIL on every test — `getByText('42')` etc. never appear, since the page still renders hardcoded `'0'` and has no activity feed or top-EPK callout yet.

- [ ] **Step 3: Add `top_epk` to `AnalyticsSummary`**

In `frontend/src/types/index.ts`, in the `AnalyticsSummary` interface, add:

```typescript
export interface AnalyticsSummary {
  from: string
  to: string
  totals: AnalyticsTotals
  daily_page_views: AnalyticsDailyPoint[]
  top_referrers: AnalyticsReferrer[]
  top_countries: AnalyticsCountry[]
  devices: AnalyticsDeviceBreakdown[]
  top_downloads: AnalyticsDownload[]
  top_private_links: AnalyticsPrivateLinkBreakdown[]
  // Present only on the workspace-wide endpoint (getWorkspaceAnalytics) --
  // undefined/absent on the per-EPK one, since a single EPK's own "top
  // EPK" would be itself.
  top_epk?: { id: number; title: string; views: number } | null
}
```

- [ ] **Step 4: Add `getWorkspaceAnalytics`**

In `frontend/src/api/analytics.ts`, add:

```typescript
export async function getWorkspaceAnalytics(workspaceId: number, range?: { from?: string; to?: string }): Promise<AnalyticsSummary> {
  const { data } = await apiClient.get<ApiResource<AnalyticsSummary>>(`/api/workspaces/${workspaceId}/analytics`, {
    params: range,
  })
  return data.data
}
```

- [ ] **Step 5: Add `useWorkspaceAnalytics`**

In `frontend/src/features/analytics/hooks/useAnalytics.ts`, add the import (`getWorkspaceAnalytics` alongside the existing `getEpkAnalytics` import) and:

```typescript
export function useWorkspaceAnalytics(workspaceId: number | undefined) {
  return useQuery({
    queryKey: ['workspaces', workspaceId, 'analytics'],
    queryFn: () => getWorkspaceAnalytics(workspaceId as number),
    enabled: workspaceId !== undefined,
  })
}
```

- [ ] **Step 6: Add the `workspaceId` param to `listNotifications`**

In `frontend/src/api/notifications.ts`, replace:

```typescript
export async function listNotifications(page = 1): Promise<ApiPaginated<AppNotification>> {
  const { data } = await apiClient.get<ApiPaginated<AppNotification>>('/api/notifications', {
    params: { page },
  })
  return data
}
```

with:

```typescript
export async function listNotifications(page = 1, workspaceId?: number): Promise<ApiPaginated<AppNotification>> {
  const { data } = await apiClient.get<ApiPaginated<AppNotification>>('/api/notifications', {
    params: { page, workspace_id: workspaceId },
  })
  return data
}
```

(axios omits an `undefined` param from the query string, so the bell's existing `listNotifications(page)` call — no second argument — is unaffected.)

- [ ] **Step 7: Add `useWorkspaceActivity`**

In `frontend/src/features/notifications/hooks/useNotifications.ts`, add:

```typescript
export function useWorkspaceActivity(workspaceId: number | undefined) {
  return useQuery({
    queryKey: ['workspaces', workspaceId, 'notifications'],
    queryFn: () => listNotifications(1, workspaceId),
    enabled: workspaceId !== undefined,
  })
}
```

- [ ] **Step 8: Create `DashboardActivityFeed.tsx`**

```tsx
import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LoadingSkeleton } from '@/components/common/LoadingSkeleton'
import { NotificationRow } from '@/components/common/NotificationRow'
import { useWorkspaceActivity } from '@/features/notifications/hooks/useNotifications'

export function DashboardActivityFeed({ workspaceId }: { workspaceId: number }) {
  const { t } = useTranslation()
  const { data, isLoading } = useWorkspaceActivity(workspaceId)

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('dashboard.activity.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <LoadingSkeleton />
        ) : !data || data.data.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('dashboard.activity.empty')}</p>
        ) : (
          <div className="space-y-1">
            {data.data.map((notification) => (
              <NotificationRow key={notification.id} notification={notification} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 9: Create `TopEpkCard.tsx`**

```tsx
import { TrendingUp } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export function TopEpkCard({ topEpk }: { topEpk: { id: number; title: string; views: number } }) {
  const { t } = useTranslation()

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <TrendingUp className="size-4 text-primary" />
          {t('dashboard.topEpk.title')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Link to={`/epks/${topEpk.id}/builder`} className="font-heading text-lg font-semibold text-foreground hover:underline">
          {topEpk.title}
        </Link>
        <p className="text-sm text-muted-foreground">
          {t('dashboard.topEpk.viewCount', { count: topEpk.views })}
        </p>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 10: Wire it all into `DashboardHome.tsx`**

Add imports:

```typescript
import { DashboardActivityFeed } from '@/features/dashboard/components/DashboardActivityFeed'
import { TopEpkCard } from '@/features/dashboard/components/TopEpkCard'
import { PageViewsChart } from '@/features/analytics/components/PageViewsChart'
import { useWorkspaceAnalytics } from '@/features/analytics/hooks/useAnalytics'
```

Add the hook call alongside the existing `useEpks` call:

```typescript
const { data: analytics } = useWorkspaceAnalytics(currentWorkspace?.id)
```

Replace the `stats` array's hardcoded values:

```typescript
const stats = [
  { label: t('dashboard.stats.totalEpks'), value: String(epks?.length ?? 0) },
  { label: t('dashboard.stats.publishedEpks'), value: String(epks?.filter((epk) => epk.status === 'published').length ?? 0) },
  { label: t('dashboard.stats.totalViews'), value: String(analytics?.totals.page_views ?? 0) },
  { label: t('dashboard.stats.downloads'), value: String(analytics?.totals.downloads ?? 0) },
]
```

After the stat-tile grid and before the "no EPKs yet" empty-state block, add:

```tsx
{analytics && (
  <>
    <PageViewsChart points={analytics.daily_page_views} />
    {analytics.top_epk && <TopEpkCard topEpk={analytics.top_epk} />}
  </>
)}
```

At the very end of the returned JSX, after the existing empty-state block's closing `)}`, add:

```tsx
<DashboardActivityFeed workspaceId={currentWorkspace.id} />
```

- [ ] **Step 11: Add the i18n keys**

Write a one-off Node script (in the scratchpad directory) that, for each of the 7 locale files, inserts a `"dashboard": { ... }` extension — since `dashboard.*` keys likely already exist for the existing `stats`/`welcome` strings, anchor the insertion on the existing `"dashboard"` object's stable last key (find it first with a grep, e.g. `grep -o "\"dashboard\": {[^}]*" frontend/src/i18n/locales/en.json` to see its current shape) and insert the new `activity`/`topEpk` sub-objects as siblings before its closing brace, exactly like the pattern used for the `billing.history` insertion in the payment-history feature (see git history for that script if a template is useful). Use these translations:

| Key | en | fr | es | pt | de | ar | zh |
|---|---|---|---|---|---|---|---|
| `dashboard.activity.title` | Recent activity | Activité récente | Actividad reciente | Atividade recente | Letzte Aktivität | النشاط الأخير | 近期动态 |
| `dashboard.activity.empty` | No recent activity yet. | Aucune activité récente pour le moment. | Aún no hay actividad reciente. | Ainda não há atividade recente. | Noch keine Aktivität. | لا يوجد نشاط حديث بعد. | 暂无近期动态。 |
| `dashboard.topEpk.title` | Top-performing EPK | EPK le plus performant | EPK con mejor rendimiento | EPK com melhor desempenho | Bestes EPK | أفضل ملف صحفي أداءً | 表现最佳的 EPK |
| `dashboard.topEpk.viewCount_one` | {{count}} view this period | {{count}} vue sur cette période | {{count}} vista en este período | {{count}} visualização neste período | {{count}} Aufruf in diesem Zeitraum | {{count}} مشاهدة في هذه الفترة | (no `_one` needed) |
| `dashboard.topEpk.viewCount_other` | {{count}} views this period | {{count}} vues sur cette période | {{count}} vistas en este período | {{count}} visualizações neste período | {{count}} Aufrufe in diesem Zeitraum | {{count}} مشاهدة في هذه الفترة | {{count}} 次浏览（本期） |

For `zh.json`, only add `viewCount_other` (Chinese has no singular/plural distinction; i18next's pluralization rules for `zh` use a single "other" form, so `_one` is never selected for that locale).

After running the script, validate every file: `node -e "JSON.parse(require('fs').readFileSync('src/i18n/locales/en.json','utf8'))"` (repeat for all 7).

- [ ] **Step 12: Run the test to verify it passes**

Run: `cd frontend && npx vitest run src/pages/DashboardHome.test.tsx`
Expected: all 5 tests PASS.

- [ ] **Step 13: Run the full frontend verification**

Run: `cd frontend && npx tsc -b --noEmit && npx vitest run && npx oxlint src/pages/DashboardHome.tsx src/features/dashboard src/api/analytics.ts src/api/notifications.ts src/features/analytics/hooks/useAnalytics.ts src/features/notifications/hooks/useNotifications.ts src/types/index.ts && npm run build`
Expected: clean typecheck, full suite green (including the pre-existing `NotificationBell.test.tsx` and every other file — this task must not break anything), no new lint warnings, build succeeds.

- [ ] **Step 14: Commit**

```bash
git add frontend/src/types/index.ts frontend/src/api/analytics.ts frontend/src/features/analytics/hooks/useAnalytics.ts frontend/src/api/notifications.ts frontend/src/features/notifications/hooks/useNotifications.ts frontend/src/features/dashboard frontend/src/pages/DashboardHome.tsx frontend/src/pages/DashboardHome.test.tsx frontend/src/i18n/locales
git commit -m "Wire the Dashboard to real analytics data and a workspace activity feed"
```

---

## After all tasks: mirror to split repos, do not push

Per this project's established process: `cp` every changed file from `epk/backend/`/`epk/frontend/` into `epk-back/`/`epk-front/` (stripping the `backend/`/`frontend/` prefix), rebuild the frontend (`npm run build`) and copy the new hashed `dist/assets/*` + `dist/index.html` into `epk-front/dist/`, then commit (same message) to all three repos. **Do not push** — push only happens on an explicit "push it" from the user.
