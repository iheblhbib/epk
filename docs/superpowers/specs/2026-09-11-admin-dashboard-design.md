# Admin Dashboard — Billing, Growth & Activity — Design

## Context

The Admin Dashboard (`AdminDashboardPage.tsx` / `AdminStatsController`) is currently
a flat grid of 8 stat tiles (users, workspaces, EPKs, page views, contacts, media)
plus a storage-used card — all sourced from a single `Cache::remember('admin.stats',
60, ...)` blob. Despite this app now having a full Stripe billing system (trial
reminders, webhook-driven status transitions, payment history — see
`docs/superpowers/specs/2026-09-02-subscription-billing-overhaul-design.md` and the
billing-hardening pass that followed it), **none of that shows up here** — no
revenue, no plan mix, no conversion or churn signal. This is the real gap this spec
closes.

Three things worth knowing before the design below:

- **Plan prices exist nowhere on the backend.** `config/plans.php` holds feature
  limits and Stripe price *ids*, not amounts. The actual EUR numbers
  (`€6.66`/`€26.66`/`€99.99` etc.) are hardcoded once, in the frontend's
  `planPricing.ts`, whose own comment says to keep them "in sync with
  `backend/config/plans.php`'s comment block" — a sync that was never actually
  backed by real data on the backend side. This spec finally puts the numbers
  there, making that comment's original intent real.
- **The existing Audit Log (`AdminAuditLogController`/`AuditLog` model) is a
  different feature.** It records admin/moderation and content actions
  (`workspace.deleted_by_admin`, `epk.published`, `member.invited`, ...), not
  platform growth events. It has no "user registered" or "workspace created" or
  "subscription changed" entries, so it cannot power a signups/activity feed —
  that needs its own query.
- **No subscription-transition history exists.** `subscriptions` rows are updated
  in place; there's no log of past status changes. This bounds what "conversion"
  and "churn" can honestly mean here (see Non-goals).
- **`stripe_customer_id` is the reliable "ever paid" signal.** Confirmed by reading
  `StripeBillingService::handleSubscriptionDeleted()`: cancellation nulls
  `stripe_subscription_id` and `billing_interval`, but **never**
  `stripe_customer_id` or `plan`. A trial that never converted has
  `stripe_customer_id === null` forever (no Stripe object was ever created for it —
  see `Workspace::booted()`); a workspace that converted and later canceled still
  has it set. This makes "did this workspace ever pay" a plain, reliable column
  check with no new tracking needed.
- **`canceled_at` is a reliable "when did this cancel" signal**, set once by the
  real Stripe-driven cancellation flow, never by a trial simply expiring
  un-converted (`trial_ends_at` passing doesn't touch `status`/`canceled_at` at
  all — `PlanLimits::hasActiveAccess` just starts returning `false`).

## Goals

- **Billing & revenue stats**: MRR, active-subscriber counts broken down by plan
  and by status, trial→paid conversion rate, and cancellations — all computed from
  local `subscriptions` rows, no live Stripe calls (consistent with the existing
  60s-cached admin stats — a live per-request Stripe call here would be slow and
  rate-limit-risky on a page every admin session visits).
- **Growth trend chart**: new users + new workspaces per day, last 30 days.
- **Recent activity feed**: recent signups and recent workspace creations,
  interleaved by date.
- **Richer per-workspace detail**: `subscription_status` (and when relevant,
  `access_ends_at`) added inline to the existing `AdminWorkspacesPage` table.

## Non-goals (explicitly out of scope for this pass)

- **True historical conversion/churn cohort tracking.** "Trial→paid conversion
  rate" here means *(workspaces created in the last 30 days with
  `stripe_customer_id` set) / (all workspaces created in the last 30 days)* — a
  simple, honest ratio from current column state, not a cohort analysis over
  arbitrary historical windows. That would need a new subscription-event history
  table; not built here.
- **Recent upgrades/downgrades/cancellations in the activity feed.** Same
  root cause — no transition history to query. The feed covers signups and new
  workspaces only. `canceled_last_30_days` (a count, not a feed) is still in the
  billing stats, since `canceled_at` makes that specific number reliable without
  needing history.
- **A new per-workspace admin drill-down page.** "Richer detail" is an inline
  column on the existing flat table, not a new page/modal.
- **Live Stripe API calls from this page.** Everything here reads local
  `subscriptions` rows only.
- **Editing prices from the admin UI.** `config/plans.php`'s new price fields are
  still config, like the rest of that file — not admin-editable data.

## Backend changes

### `config/plans.php` — add real prices

Add two new keys per plan, matching the frontend's existing `planPricing.ts`
numbers exactly (values transcribed from that file, not re-derived):

```php
'starter' => [
    // ...existing keys unchanged...
    'price_monthly' => 6.66,
    'price_yearly_effective_monthly' => 5.55,
],

'pro' => [
    // ...existing keys unchanged...
    'price_monthly' => 26.66,
    'price_yearly_effective_monthly' => 22.22,
],

'business' => [
    // ...existing keys unchanged...
    'price_monthly' => 99.99,
    'price_yearly_effective_monthly' => 83.33,
],
```

Update the file's top doc comment to note these are now the canonical prices, and
that `frontend/src/lib/planPricing.ts` mirrors them (reversing which file's comment
points at which — today only the frontend points at the backend).

### `app/Services/AdminBillingStats.php` (new)

A small service, matching this codebase's convention of one service per
non-trivial aggregation (`PlanLimits`, `AnalyticsAggregator`, `WorkspaceDigestBuilder`):

```php
<?php

namespace App\Services;

use App\Enums\SubscriptionPlan;
use App\Enums\SubscriptionStatus;
use App\Models\Subscription;
use App\Models\Workspace;

/**
 * Billing/revenue numbers for the admin dashboard, computed entirely from
 * local `subscriptions` rows -- no live Stripe calls (this runs inside the
 * existing 60s-cached admin stats blob, on a page every admin session
 * visits, so a per-request Stripe round trip would be both slow and an
 * unnecessary rate-limit risk).
 */
class AdminBillingStats
{
    /**
     * @return array{mrr: float, active_by_plan: array<string, int>, by_status: array<string, int>, trial_conversion_rate: float, canceled_last_30_days: int}
     */
    public function summarize(): array
    {
        $activeSubscriptions = Subscription::where('status', SubscriptionStatus::Active)->get(['plan', 'billing_interval']);

        $mrr = $activeSubscriptions->sum(function (Subscription $subscription) {
            $prices = config("plans.{$subscription->plan->value}");

            return $subscription->billing_interval === 'yearly'
                ? $prices['price_yearly_effective_monthly']
                : $prices['price_monthly'];
        });

        $activeByPlan = collect(SubscriptionPlan::cases())->mapWithKeys(
            fn (SubscriptionPlan $plan) => [$plan->value => $activeSubscriptions->where('plan', $plan)->count()]
        )->all();

        $byStatus = collect(SubscriptionStatus::cases())->mapWithKeys(
            fn (SubscriptionStatus $status) => [$status->value => Subscription::where('status', $status)->count()]
        )->all();

        $recentWorkspaces = Workspace::where('created_at', '>=', now()->subDays(30))->count();
        $recentConverted = Workspace::where('created_at', '>=', now()->subDays(30))
            ->whereHas('subscription', fn ($query) => $query->whereNotNull('stripe_customer_id'))
            ->count();

        $canceledLast30Days = Subscription::where('status', SubscriptionStatus::Canceled)
            ->where('canceled_at', '>=', now()->subDays(30))
            ->count();

        return [
            'mrr' => round($mrr, 2),
            'active_by_plan' => $activeByPlan,
            'by_status' => $byStatus,
            'trial_conversion_rate' => $recentWorkspaces > 0 ? round(($recentConverted / $recentWorkspaces) * 100, 1) : 0.0,
            'canceled_last_30_days' => $canceledLast30Days,
        ];
    }
}
```

### `app/Services/AdminGrowthStats.php` (new)

```php
<?php

namespace App\Services;

use App\Models\User;
use App\Models\Workspace;
use Carbon\CarbonImmutable;

/**
 * Daily new-user / new-workspace counts for the admin dashboard's growth
 * chart. Fixed 30-day window, matching this app's other dashboard defaults
 * (Analytics page, workspace Dashboard).
 */
class AdminGrowthStats
{
    /**
     * @return list<array{date: string, new_users: int, new_workspaces: int}>
     */
    public function dailyGrowth(): array
    {
        $from = CarbonImmutable::now()->subDays(29)->startOfDay();

        $userCounts = User::where('created_at', '>=', $from)
            ->selectRaw('DATE(created_at) as date, COUNT(*) as count')
            ->groupBy('date')
            ->pluck('count', 'date');

        $workspaceCounts = Workspace::where('created_at', '>=', $from)
            ->selectRaw('DATE(created_at) as date, COUNT(*) as count')
            ->groupBy('date')
            ->pluck('count', 'date');

        $days = [];
        for ($cursor = $from; $cursor->lte(CarbonImmutable::now()); $cursor = $cursor->addDay()) {
            $key = $cursor->toDateString();
            $days[] = [
                'date' => $key,
                'new_users' => (int) ($userCounts[$key] ?? 0),
                'new_workspaces' => (int) ($workspaceCounts[$key] ?? 0),
            ];
        }

        return $days;
    }
}
```

### `AdminStatsController` — wire both services in

```php
public function __construct(
    private readonly AdminBillingStats $billingStats,
    private readonly AdminGrowthStats $growthStats,
) {}

public function index(): JsonResponse
{
    $data = Cache::remember('admin.stats', 60, fn () => [
        // ...existing users/workspaces/epks/media/contacts/analytics keys, unchanged...
        'billing' => $this->billingStats->summarize(),
        'growth' => $this->growthStats->dailyGrowth(),
    ]);

    return response()->json(['data' => $data]);
}
```

(Constructor property promotion added to a controller that previously had none —
matches the pattern already used by `BillingController`, `AnalyticsController`.)

### `app/Http/Controllers/Api/Admin/AdminActivityController.php` (new)

```php
<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Http\JsonResponse;

class AdminActivityController extends Controller
{
    /**
     * Recent signups and recent workspace creations, interleaved by date,
     * newest first. Deliberately not the AuditLog (a different feature --
     * see the spec's Context) and not cached: this is a short, cheap query
     * an admin expects to be fresh on every load, unlike the heavier
     * 60s-cached stats blob.
     */
    public function index(): JsonResponse
    {
        $users = User::latest()->take(10)->get(['id', 'name', 'email', 'created_at'])
            ->map(fn (User $user) => [
                'kind' => 'user_signed_up',
                'label' => $user->name,
                'detail' => $user->email,
                'created_at' => $user->created_at,
            ]);

        $workspaces = Workspace::with('creator:id,name')->latest()->take(10)->get(['id', 'name', 'created_by', 'created_at'])
            ->map(fn (Workspace $workspace) => [
                'kind' => 'workspace_created',
                'label' => $workspace->name,
                'detail' => $workspace->creator?->name,
                'created_at' => $workspace->created_at,
            ]);

        $activity = $users->concat($workspaces)
            ->sortByDesc('created_at')
            ->take(10)
            ->values();

        return response()->json(['data' => $activity]);
    }
}
```

### `AdminWorkspaceController::index()` — add subscription status inline

The `with(['creator:id,name,email', 'subscription'])` eager-load already pulls the
subscription row; only the mapped output array needs the two new fields.
Constructor-inject `PlanLimits` (already the canonical `accessEndsAt` source, used
identically by `BillingController::show()`):

```php
public function __construct(private readonly PlanLimits $planLimits) {}

// inside the existing ->through() closure, add two keys:
'subscription_status' => $workspace->subscription?->status,
'access_ends_at' => $this->planLimits->accessEndsAt($workspace),
```

### Routes

`routes/api.php`, inside the existing `prefix('admin')` group (around line 250):

```php
Route::get('/activity', [AdminActivityController::class, 'index']);
```

No new route needed for the stats/workspace-list changes — those extend existing
endpoints' response bodies.

## Frontend changes

### `types/index.ts`

```typescript
export interface AdminStats {
  users: { total: number; new_last_7_days: number; new_last_30_days: number }
  workspaces: { total: number }
  epks: { total: number; published: number; draft: number; archived: number }
  media: { total: number; storage_bytes: number }
  contacts: { total: number }
  analytics: { total_page_views: number; page_views_last_30_days: number }
  billing: {
    mrr: number
    active_by_plan: Record<SubscriptionPlan, number>
    by_status: Record<SubscriptionStatus, number>
    trial_conversion_rate: number
    canceled_last_30_days: number
  }
  growth: { date: string; new_users: number; new_workspaces: number }[]
}

export interface AdminActivityEntry {
  kind: 'user_signed_up' | 'workspace_created'
  label: string
  detail: string | null
  created_at: string
}
```

`AdminWorkspace` gains the two new fields:

```typescript
export interface AdminWorkspace {
  id: number
  name: string
  slug: string
  members_count: number
  epks_count: number
  plan: SubscriptionPlan | null
  subscription_status: SubscriptionStatus | null
  access_ends_at: string | null
  creator: { id: number; name: string } | null
  created_at: string
}
```

### `api/admin.ts` — new `getAdminActivity`

```typescript
export async function getAdminActivity(): Promise<AdminActivityEntry[]> {
  const { data } = await apiClient.get<ApiResource<AdminActivityEntry[]>>('/api/admin/activity')
  return data.data
}
```

### `features/admin/hooks/useAdmin.ts` — new `useAdminActivity`

```typescript
export function useAdminActivity() {
  return useQuery({ queryKey: ['admin', 'activity'], queryFn: getAdminActivity })
}
```

### `features/admin/components/AdminGrowthChart.tsx` (new)

A small, self-contained two-series line chart, following `PageViewsChart`'s exact
Chart.js setup/registration/empty-state pattern but with two datasets instead of
one. Not a generalization of `PageViewsChart` itself — that component's callers
(Analytics page, workspace Dashboard) are already working and single-series; a
second small component is less risk than reshaping a shared one mid-flight:

```tsx
import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
  type ChartOptions,
} from 'chart.js'
import { useTranslation } from 'react-i18next'
import { Line } from 'react-chartjs-2'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler)

const OPTIONS: ChartOptions<'line'> = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { tooltip: { intersect: false, mode: 'index' } },
  scales: { x: { grid: { display: false } }, y: { beginAtZero: true, ticks: { precision: 0 } } },
}

export function AdminGrowthChart({ points }: { points: { date: string; new_users: number; new_workspaces: number }[] }) {
  const { t } = useTranslation()

  const data = {
    labels: points.map((point) => new Date(`${point.date}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })),
    datasets: [
      {
        label: t('admin.dashboard.growth.newUsers'),
        data: points.map((point) => point.new_users),
        borderColor: '#cc1417',
        backgroundColor: 'rgba(204, 20, 23, 0.12)',
        fill: true,
        tension: 0.3,
        pointRadius: 0,
      },
      {
        label: t('admin.dashboard.growth.newWorkspaces'),
        data: points.map((point) => point.new_workspaces),
        borderColor: '#6D5EF9',
        backgroundColor: 'rgba(109, 94, 249, 0.12)',
        fill: true,
        tension: 0.3,
        pointRadius: 0,
      },
    ],
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="mb-3 text-xs font-medium tracking-wide text-muted-foreground uppercase">{t('admin.dashboard.growth.title')}</p>
      {points.every((point) => point.new_users === 0 && point.new_workspaces === 0) ? (
        <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
          {t('admin.dashboard.growth.empty')}
        </div>
      ) : (
        <div className="h-48">
          <Line data={data} options={OPTIONS} />
        </div>
      )}
    </div>
  )
}
```

### `features/admin/components/AdminActivityFeed.tsx` (new)

```tsx
import { UserPlus, UsersRound } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LoadingSkeleton } from '@/components/common/LoadingSkeleton'
import { formatRelativeTime } from '@/lib/relativeTime'
import { useAdminActivity } from '@/features/admin/hooks/useAdmin'
import type { AdminActivityEntry } from '@/types'

function ActivityRow({ entry }: { entry: AdminActivityEntry }) {
  const { t, i18n } = useTranslation()
  const isSignup = entry.kind === 'user_signed_up'

  return (
    <div className="flex gap-3 rounded-md px-2 py-2.5 text-sm">
      <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
        {isSignup ? <UserPlus className="size-4 text-primary" /> : <UsersRound className="size-4 text-primary" />}
      </div>
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="text-foreground">
          {isSignup
            ? t('admin.dashboard.activity.signedUp', { name: entry.label })
            : t('admin.dashboard.activity.workspaceCreated', { name: entry.label, creator: entry.detail ?? t('notifications.someone') })}
        </p>
        <p className="text-xs text-muted-foreground">{formatRelativeTime(entry.created_at, i18n.resolvedLanguage ?? 'en')}</p>
      </div>
    </div>
  )
}

export function AdminActivityFeed() {
  const { t } = useTranslation()
  const { data, isLoading } = useAdminActivity()

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('admin.dashboard.activity.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <LoadingSkeleton />
        ) : !data || data.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('admin.dashboard.activity.empty')}</p>
        ) : (
          <div className="space-y-1">
            {data.map((entry, index) => (
              <ActivityRow key={`${entry.kind}-${entry.created_at}-${index}`} entry={entry} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
```

(`key` uses a composite since the backend response has no stable id across the two
merged sources — acceptable here since the list is never reordered client-side.)

### `AdminDashboardPage.tsx` — wire it together

- Add billing stat tiles after the existing grid: MRR (`formatEuro`-style, reusing
  the existing helper from `lib/planPricing.ts`), trial conversion rate (`%`),
  cancellations this 30 days.
- Add a small "active subscribers by plan" breakdown (three numbers, Starter/Pro/
  Business — reusing the existing `BreakdownCard` component from
  `features/analytics/components/`, which already renders a labeled-rows card).
- `<AdminGrowthChart points={stats.growth} />` below the tiles.
- `<AdminActivityFeed />` at the end.

### `AdminWorkspacesPage.tsx` — add the status column

New `<TableHead>`/`<TableCell>` for `subscription_status`, rendered as a `Badge`
(same variant logic already established in `BillingPage.tsx`'s
`SubscriptionStatusBanner`: destructive for `canceled`/`unpaid`, amber/outline for
`past_due`, secondary for `active`, default for `trialing`) — extracting that
variant-picking logic isn't needed here (it's a one-line ternary chain, not worth a
shared helper for two call sites with slightly different visual treatments).

### i18n

New keys in all 7 locales: `admin.dashboard.billing.{mrr, activeByPlan,
trialConversionRate, canceledLast30Days}`, `admin.dashboard.growth.{title, newUsers,
newWorkspaces, empty}`, `admin.dashboard.activity.{title, empty, signedUp,
workspaceCreated}`, `admin.workspaces.columns.subscriptionStatus`.

## Testing plan

**Backend (Pest)** — this codebase keeps every admin-panel backend test in one
file, `tests/Feature/Admin/AdminPanelTest.php` (confirmed: it already has
`'returns platform-wide stats to an admin'` and `'lets an admin list and delete
workspaces'` among others, covering stats/users/workspaces/epks/audit-log
together). All new tests below extend that same file, matching the existing
convention, rather than splitting into new per-concern files:

- MRR sums only `Active` subscriptions, correctly normalizing yearly to monthly
  (a yearly Pro sub contributes `22.22`, not `26.66` or `266.64`).
- `PastDue`/`Unpaid`/`Canceled`/`Trialing` subscriptions are excluded from MRR.
- `active_by_plan` and `by_status` counts are correct across a mixed set.
- `trial_conversion_rate`: a workspace created in the window with
  `stripe_customer_id` set counts as converted; one without does not; 0 recent
  workspaces returns `0.0` rather than dividing by zero.
- `canceled_last_30_days` only counts subscriptions whose `canceled_at` falls in
  the window, not ones canceled earlier.
- Growth: returns exactly 30 days of entries, oldest first, even for days with
  zero signups (a day with no users must still appear as `0`, not be omitted).
- Activity: returns signups and workspace creations interleaved by `created_at`,
  newest first, capped at 10 total (not 10 of each); requires admin auth
  (non-admin gets denied, matching this file's existing
  `'blocks a non-admin from every admin endpoint'` coverage — extend that
  existing test's route list rather than writing a separate denial test).
- The existing `'lets an admin list and delete workspaces'` test gains
  assertions that the response includes `subscription_status` and
  `access_ends_at` matching the workspace's actual subscription state.

**Frontend (Vitest)**:

- `AdminDashboardPage.test.tsx` (new, or extend if one exists): billing tiles
  render mocked MRR/conversion/cancellation numbers; growth chart renders without
  crashing on mocked `growth` data (matching the canvas-stub pattern already added
  to `src/test/setup.ts` for `PageViewsChart`); activity feed renders mocked
  signup/workspace-creation rows with correct icon per kind.
- `AdminWorkspacesPage.test.tsx`: new status column renders the right badge
  variant per status.

## Open items for the implementation plan

- Final i18n strings for all new keys, in all 7 locales.
- Exact placement of the billing tiles / breakdown card / growth chart relative to
  the existing 8-tile grid (a small layout call, not architectural).
