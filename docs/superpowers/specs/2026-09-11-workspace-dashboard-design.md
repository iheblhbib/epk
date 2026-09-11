# Workspace Dashboard — Real Data & Activity — Design

## Context

`DashboardHome.tsx` is currently a stub: 4 stat tiles (Total EPKs, Published EPKs,
Total Views, Downloads), where the last two are **hardcoded to `'0'`** — never wired
to any real data. There's no chart, no "what's actually happening" signal, nothing
that makes this page worth opening over the Analytics page.

Real analytics infrastructure already exists, but only **per-EPK**:
`AnalyticsAggregator::summarize(Epk $epk, ...)` powers `GET /epks/{epk}/analytics`
and the whole Analytics page (stat tiles, a Chart.js trend line, four breakdown
cards). There's a second, *workspace-scoped* aggregator already in the codebase —
`WorkspaceDigestBuilder` — but it's private to the `digest:weekly` email command:
different response shape (prior-period comparison, single `top_epk`/`top_referrer`
instead of full breakdowns), not exposed via any API.

Separately, the `notifications` table (Laravel's standard database-notifications
store) already carries a `workspace_id` inside its JSON `data` payload for every
kind that has a database channel (`draft_reminder`, `epk_published`,
`invitation_accepted`, `member_role_changed`, `private_link_opened`,
`team_member_joined`, `view_milestone`, `weekly_digest`, `workspace_invitation`) —
confirmed by grepping `app/Notifications/*.php`. This is a ready-made activity log;
nothing new needs to be built to get one.

This spec covers exactly one page: the workspace Dashboard (`/` /
`DashboardHome.tsx`). The Admin dashboard is a separate spec, built after this one
ships.

## Goals

- Total Views / Downloads stat tiles show real numbers for the current workspace
  (last 30 days, matching the Analytics page's own default range).
- A trend chart (reusing `PageViewsChart` as-is) shows workspace-wide daily page
  views over that window.
- A "top-performing EPK" callout names the single EPK with the most views in the
  window.
- A "recent activity" feed lists the current user's last ~10 notifications that
  belong to this workspace, using the exact same row rendering (icon, text, link,
  unread dot) as the existing `NotificationBell` dropdown — not a re-implementation.
- All of the above degrade sensibly for a workspace with zero EPKs / zero traffic
  (empty states, not broken charts).

## Non-goals (explicitly out of scope for this pass)

- The Admin dashboard (billing/revenue stats, growth chart, admin activity feed,
  richer per-workspace admin detail) — separate spec, built next.
- A date-range picker on the workspace Dashboard — fixed at "last 30 days" for this
  pass, unlike the Analytics page's 7/30/90 toggle. Simpler, and this page's job is
  a fast glance, not a report.
- Marking dashboard-feed notifications as read from the feed itself — clicking a row
  navigates and marks it read via the exact same `useMarkNotificationAsRead`
  mutation `NotificationBell` already uses, so this falls out of the reuse for free;
  no new interaction to design.
- Changing `WorkspaceDigestBuilder` or the weekly-digest email — untouched.

## Backend changes

### `AnalyticsAggregator` — new `summarizeForWorkspace` method

Add a sibling to the existing `summarize()`, scoped across all of a workspace's EPKs
instead of one. Deliberately mirrors `summarize()`'s exact return shape (so the
frontend can reuse every existing component unchanged), plus one addition —
`top_epk` — lifted from `WorkspaceDigestBuilder`'s existing logic:

```php
/**
 * @return array{totals: array, daily_page_views: array, top_referrers: array,
 *     top_countries: array, devices: array, top_downloads: array,
 *     top_private_links: array, top_epk: array{id: int, title: string, views: int}|null}
 */
public function summarizeForWorkspace(Workspace $workspace, CarbonInterface $from, CarbonInterface $to): array
{
    $epks = $workspace->epks()->get(['id', 'title']);
    $epkIds = $epks->pluck('id');

    // Same base-query pattern as summarize(), just scoped by a set of EPK ids
    // (via whereIn) instead of a single EPK's own relation.
    $base = fn () => AnalyticsEvent::query()->toBase()
        ->whereIn('analytics_events.epk_id', $epkIds)
        ->whereBetween('analytics_events.created_at', [$from, $to]);

    // ...totals / daily_page_views / top_referrers / top_countries / devices /
    // top_downloads / top_private_links: identical bodies to summarize(), just
    // built from this $base() instead of $epk->analyticsEvents(). No behavior
    // difference beyond the scope, so not repeated verbatim here — see
    // summarize() for the exact per-metric queries to copy.

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

`$epkIds` empty (no EPKs yet) is not special-cased — every query below it degrades
naturally to zero counts / empty arrays via `whereIn('epk_id', [])`, which Laravel
turns into a query that matches nothing. No status filter (published-only) is
applied, matching `summarize()`'s own behavior — a draft EPK realistically has no
view events anyway, and this stays consistent with the per-EPK page rather than
introducing a second filtering rule to keep in sync.

### `AnalyticsController` — new `forWorkspace` action

Same controller, a second action alongside the existing per-EPK `show()`:

```php
public function forWorkspace(AnalyticsQueryRequest $request, Workspace $workspace): JsonResponse
{
    $this->authorize('view', $workspace);

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

`AnalyticsQueryRequest` (already validates optional `from`/`to`) is reused as-is —
no new form request needed.

### Route

`routes/api.php`, alongside the other `/workspaces/{workspace}/...` routes:

```php
Route::get('/workspaces/{workspace}/analytics', [AnalyticsController::class, 'forWorkspace']);
```

### `NotificationController::index` — optional workspace filter

Additive change, existing callers (the bell dropdown, which wants everything) keep
working unchanged:

```php
public function index(Request $request): JsonResponse
{
    $query = $request->user()->notifications();

    if ($request->filled('workspace_id')) {
        $query->where('data->workspace_id', (string) $request->integer('workspace_id'));
    }

    $notifications = $query->paginate(15);

    return NotificationResource::collection($notifications)->response();
}
```

Cast to `(string)`: `workspace_id` is written into the JSON payload as a string in
some notifications (e.g. `'workspace_id' => $workspace->id` where `$workspace->id`
is an int, so actually stored as a JSON number in most — but
`WorkspaceInvitationNotification` and a couple of others may differ). To avoid a
type-mismatch footgun between "stored as JSON int" vs "stored as JSON string"
across nine different notification classes, the implementation step must grep each
of the nine `toDatabase()` methods and confirm `workspace_id` is written the same
way (prefer plain `$workspace->id`, an int, consistently) before relying on a single
comparison type here — fix any outlier to match rather than special-casing the
query. `data` is a `text` column (not native MySQL `json`), but Laravel's
`->` JSON-path `where()` still works against it via `JSON_EXTRACT`/`JSON_UNQUOTE`,
since MySQL's JSON functions operate on any string containing valid JSON,
independent of the column's declared type.

No pagination-shape change — the Dashboard only wants the first page (~10 rows), so
the frontend simply doesn't request page 2.

## Frontend changes

### `api/analytics.ts` — new `getWorkspaceAnalytics`

```typescript
export async function getWorkspaceAnalytics(workspaceId: number, range?: { from?: string; to?: string }): Promise<AnalyticsSummary> {
  const { data } = await apiClient.get<ApiResource<AnalyticsSummary>>(`/api/workspaces/${workspaceId}/analytics`, {
    params: range,
  })
  return data.data
}
```

`AnalyticsSummary` (in `types/index.ts`) gains one optional field, since the
workspace endpoint adds it but the per-EPK one doesn't:

```typescript
export interface AnalyticsSummary {
  // ...unchanged existing fields
  top_epk?: { id: number; title: string; views: number } | null
}
```

### `features/analytics/hooks/useAnalytics.ts` — new `useWorkspaceAnalytics`

```typescript
export function useWorkspaceAnalytics(workspaceId: number | undefined) {
  return useQuery({
    queryKey: ['workspaces', workspaceId, 'analytics'],
    queryFn: () => getWorkspaceAnalytics(workspaceId as number),
    enabled: workspaceId !== undefined,
  })
}
```

No `range` param threaded through for this pass (fixed last-30-days, per Goals) —
`getWorkspaceAnalytics` still accepts the param for API symmetry with the per-EPK
version, simply unused by this hook's caller today.

### `api/notifications.ts` — `listNotifications` gains an optional filter

```typescript
export async function listNotifications(page = 1, workspaceId?: number): Promise<ApiPaginated<AppNotification>> {
  const { data } = await apiClient.get<ApiPaginated<AppNotification>>('/api/notifications', {
    params: { page, workspace_id: workspaceId },
  })
  return data
}
```

`workspace_id: undefined` is dropped from the query string by axios automatically
(existing behavior elsewhere in this codebase), so the bell dropdown's existing call
site (`listNotifications(page)`, no second arg) is unaffected.

### `features/notifications/hooks/useNotifications.ts` — new `useWorkspaceActivity`

```typescript
export function useWorkspaceActivity(workspaceId: number | undefined) {
  return useQuery({
    queryKey: ['workspaces', workspaceId, 'notifications'],
    queryFn: () => listNotifications(1, workspaceId),
    enabled: workspaceId !== undefined,
  })
}
```

No polling (unlike the bell's unread count) — this is a glance-on-load feed, not a
live badge.

### Extract `NotificationRow` out of `NotificationBell.tsx`

Move `NotificationRowShell` and `NotificationRow` (currently private to
`NotificationBell.tsx`) into a new file,
`frontend/src/components/common/NotificationRow.tsx`, exporting both. `NotificationBell.tsx`
imports them back instead of declaring them inline — a pure extraction, no behavior
change, so its own existing tests keep passing unmodified. This is what lets the new
Dashboard feed render *exactly* the same row (icon, blurb, relative time, unread
dot, click-to-navigate-and-mark-read) with zero duplicated switch-statement logic.

### `DashboardActivityFeed.tsx` (new)

```tsx
import { useWorkspaceActivity } from '@/features/notifications/hooks/useNotifications'
import { NotificationRow } from '@/components/common/NotificationRow'

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

### `DashboardHome.tsx` — wiring it together

- Replace the `stats` array's hardcoded `'0'`s for Total Views / Downloads with
  `analytics?.totals.page_views` / `analytics?.totals.downloads` from
  `useWorkspaceAnalytics(currentWorkspace?.id)`. Total EPKs / Published EPKs stay
  computed from `useEpks` exactly as today — no change there.
- Below the stat tiles: `<PageViewsChart points={analytics.daily_page_views} />`
  (component reused verbatim, zero changes).
- A new small callout card for `analytics.top_epk` (title + view count, linking to
  that EPK's builder page) — rendered only when `top_epk` is non-null.
- `<DashboardActivityFeed workspaceId={currentWorkspace.id} />` at the bottom.
- The existing "no EPKs yet" empty state stays exactly where it is (still the right
  behavior for a genuinely empty workspace) — the new stats/chart/feed sections
  simply aren't reached in that case, since they render after that early return
  today and will continue to.

### i18n

New keys in all 7 locales: `dashboard.activity.title`, `dashboard.activity.empty`,
`dashboard.topEpk.title` (or similar — exact strings finalized in the
implementation plan).

## Testing plan

**Backend (Pest)**, new `tests/Feature/Analytics/WorkspaceAnalyticsTest.php`:
- Returns aggregated totals across two EPKs in the same workspace (page view on
  each counts toward the combined total).
- `top_epk` names the EPK with more views when two EPKs have different counts;
  `null` when the workspace has zero page views in the window.
- A non-member of the workspace gets `403`.
- A workspace with zero EPKs returns all-zero totals and an empty `daily_page_views`
  array, not an error.

Extend `tests/Feature/Notifications/*` (or wherever existing notification tests
live — confirm exact path in the implementation plan) with:
- `GET /notifications?workspace_id=X` returns only notifications whose payload
  `workspace_id` matches `X`.
- Omitting `workspace_id` returns every notification for the user, unchanged from
  today (regression check on the bell dropdown's own call).

**Frontend (Vitest)**:
- `DashboardHome.test.tsx`: Total Views / Downloads render the mocked analytics
  totals (not `'0'`); the top-EPK callout renders when `top_epk` is present and is
  absent when `null`; the activity feed renders mocked notification rows.
- `NotificationRow.test.tsx` (new, moved out of whatever currently covers
  `NotificationBell.tsx`'s row rendering, if anything does): confirm the extraction
  didn't change any kind's rendered output — same assertions, new file.

## Open items for the implementation plan

- Confirm the exact file/path of any existing notification-related backend tests
  to extend rather than duplicate.
- Grep and normalize `workspace_id`'s JSON type (int vs string) across all nine
  `toDatabase()` payloads that carry it, per the note under "NotificationController
  — optional workspace filter" above, before wiring the query filter.
- Final i18n strings for `dashboard.activity.*` and the top-EPK callout, in all 7
  locales.
- Exact placement/styling of the top-EPK callout card relative to the stat-tile
  grid (above the chart vs. beside it) — a small layout call to make while
  implementing, not an architectural one.
