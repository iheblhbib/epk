# Admin Dashboard — Billing, Growth & Activity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add real billing/revenue stats, a growth trend chart, a recent-activity feed, and inline subscription status to the Admin Dashboard and admin workspaces table.

**Architecture:** Two new backend service classes (`AdminBillingStats`, `AdminGrowthStats`) feed into the existing 60s-cached `AdminStatsController::index()` response. A new `AdminActivityController` adds a small, uncached endpoint for recent signups/workspaces. `AdminWorkspaceController::index()` gains two fields on its existing response. All computed from local `subscriptions`/`users`/`workspaces` rows — no live Stripe calls.

**Tech Stack:** Laravel 12 / Pest (backend), React + TypeScript + Vitest + MSW (frontend). No new tables.

**Spec:** [docs/superpowers/specs/2026-09-11-admin-dashboard-design.md](../specs/2026-09-11-admin-dashboard-design.md)

## Global Constraints

- Every new/changed PHP file must pass `vendor/bin/pint --test app/ tests/ routes/` before a task is considered done (autofix with `vendor/bin/pint <files>` first).
- Every new/changed TS/TSX file must pass `npx tsc -b --noEmit` and `npx oxlint <files>`.
- No new database migrations — everything reuses existing `users`, `workspaces`, `subscriptions` columns.
- **All backend admin-panel tests live in one file**, `backend/tests/Feature/Admin/AdminPanelTest.php` (confirmed during planning — it already covers stats/users/workspaces/epks/audit-log together). Every task below extends that same file; do not create new per-concern test files.
- `Subscription::factory()->create()` **fails** on its own (unique `workspace_id` constraint — `Workspace::booted()` already creates one per workspace). Always create the workspace first, then `$workspace->subscription()->update([...])` to set its status/plan/billing_interval/etc.
- `stripe_customer_id` is never cleared by cancellation (only `stripe_subscription_id`/`billing_interval` are, plus `status`→`Canceled` and `canceled_at` set) — this is the reliable "ever paid" signal used by the trial-conversion calculation; confirmed by reading `StripeBillingService::handleSubscriptionDeleted()`.
- i18n edits touch all 7 locale files (`frontend/src/i18n/locales/{en,fr,es,pt,de,ar,zh}.json`), hand-formatted with CRLF line endings — edit with a targeted string replace anchored on a stable, unique surrounding string (verify uniqueness with a grep/count before replacing), never `JSON.stringify`. Validate every edited file with `JSON.parse` afterward.
- `AdminStatsController` currently has no constructor — Task 1 adds one (constructor property promotion), matching the pattern already used by `BillingController`/`AnalyticsController`.

---

### Task 1: Backend — billing & growth stats

**Files:**
- Modify: `backend/config/plans.php`
- Create: `backend/app/Services/AdminBillingStats.php`
- Create: `backend/app/Services/AdminGrowthStats.php`
- Modify: `backend/app/Http/Controllers/Api/Admin/AdminStatsController.php`
- Test: `backend/tests/Feature/Admin/AdminPanelTest.php` (extend)

**Interfaces:**
- Produces: `AdminBillingStats::summarize(): array{mrr: float, active_by_plan: array<string,int>, by_status: array<string,int>, trial_conversion_rate: float, canceled_last_30_days: int}`.
- Produces: `AdminGrowthStats::dailyGrowth(): list<array{date: string, new_users: int, new_workspaces: int}>` (exactly 30 entries, oldest first).
- `GET /api/admin/stats`'s existing response gains `billing` and `growth` keys alongside the existing `users`/`workspaces`/`epks`/`media`/`contacts`/`analytics` keys (all unchanged).

- [ ] **Step 1: Write the failing tests**

Append to `backend/tests/Feature/Admin/AdminPanelTest.php`. Add `use App\Enums\SubscriptionPlan;` and `use App\Enums\SubscriptionStatus;` to the top imports (not yet imported in this file).

```php
it('computes MRR from active subscriptions, normalizing yearly to monthly', function () {
    Cache::forget('admin.stats');
    $admin = User::factory()->admin()->create();

    $monthlyPro = Workspace::factory()->create();
    $monthlyPro->subscription()->update(['status' => SubscriptionStatus::Active, 'plan' => SubscriptionPlan::Pro, 'billing_interval' => 'monthly', 'trial_ends_at' => null]);

    $yearlyPro = Workspace::factory()->create();
    $yearlyPro->subscription()->update(['status' => SubscriptionStatus::Active, 'plan' => SubscriptionPlan::Pro, 'billing_interval' => 'yearly', 'trial_ends_at' => null]);

    // Not active -- must not contribute to MRR.
    $pastDue = Workspace::factory()->create();
    $pastDue->subscription()->update(['status' => SubscriptionStatus::PastDue, 'plan' => SubscriptionPlan::Business, 'billing_interval' => 'monthly', 'trial_ends_at' => null]);

    $response = $this->actingAs($admin)->getJson('/api/admin/stats');

    // round() on both sides, not a raw float-literal comparison: 26.66 +
    // 22.22 isn't exactly representable in binary floating point, and the
    // backend's own round($mrr, 2) normalizes its side -- comparing against
    // an un-rounded PHP expression risks a spurious float-precision mismatch.
    $response->assertOk();
    expect(round((float) $response->json('data.billing.mrr'), 2))->toBe(round(26.66 + 22.22, 2));
});

it('breaks active subscriptions down by plan and every subscription down by status', function () {
    Cache::forget('admin.stats');
    $admin = User::factory()->admin()->create();

    $activeStarter = Workspace::factory()->create();
    $activeStarter->subscription()->update(['status' => SubscriptionStatus::Active, 'plan' => SubscriptionPlan::Starter, 'billing_interval' => 'monthly', 'trial_ends_at' => null]);

    $canceled = Workspace::factory()->create();
    $canceled->subscription()->update(['status' => SubscriptionStatus::Canceled, 'plan' => SubscriptionPlan::Pro, 'canceled_at' => now(), 'trial_ends_at' => null]);

    $response = $this->actingAs($admin)->getJson('/api/admin/stats');

    $response->assertOk()
        ->assertJsonPath('data.billing.active_by_plan.starter', 1)
        ->assertJsonPath('data.billing.active_by_plan.pro', 0)
        ->assertJsonPath('data.billing.by_status.active', 1)
        ->assertJsonPath('data.billing.by_status.canceled', 1);
});

it('computes trial conversion rate from stripe_customer_id, not status', function () {
    Cache::forget('admin.stats');
    $admin = User::factory()->admin()->create();

    // Converted: has a stripe_customer_id (even though later canceled --
    // cancellation never clears this field).
    $converted = Workspace::factory()->create();
    $converted->subscription()->update(['status' => SubscriptionStatus::Canceled, 'stripe_customer_id' => 'cus_converted', 'canceled_at' => now(), 'trial_ends_at' => null]);

    // Never converted: still trialing, no stripe_customer_id.
    Workspace::factory()->create();

    $response = $this->actingAs($admin)->getJson('/api/admin/stats');

    $response->assertOk()->assertJsonPath('data.billing.trial_conversion_rate', 50.0);
});

it('returns a zero trial conversion rate rather than dividing by zero when no workspaces were created recently', function () {
    Cache::forget('admin.stats');
    $admin = User::factory()->admin()->create();

    $old = Workspace::factory()->create(['created_at' => now()->subDays(60)]);
    $old->subscription()->update(['trial_ends_at' => null]);

    $response = $this->actingAs($admin)->getJson('/api/admin/stats');

    $response->assertOk()->assertJsonPath('data.billing.trial_conversion_rate', 0.0);
});

it('only counts cancellations within the last 30 days', function () {
    Cache::forget('admin.stats');
    $admin = User::factory()->admin()->create();

    $recentlyCanceled = Workspace::factory()->create();
    $recentlyCanceled->subscription()->update(['status' => SubscriptionStatus::Canceled, 'canceled_at' => now()->subDays(5), 'trial_ends_at' => null]);

    $oldCanceled = Workspace::factory()->create();
    $oldCanceled->subscription()->update(['status' => SubscriptionStatus::Canceled, 'canceled_at' => now()->subDays(60), 'trial_ends_at' => null]);

    $response = $this->actingAs($admin)->getJson('/api/admin/stats');

    $response->assertOk()->assertJsonPath('data.billing.canceled_last_30_days', 1);
});

it('returns exactly 30 days of growth data, oldest first, including zero-signup days', function () {
    Cache::forget('admin.stats');
    $admin = User::factory()->admin()->create();
    User::factory()->create(['created_at' => now()]);

    $response = $this->actingAs($admin)->getJson('/api/admin/stats');

    $response->assertOk();
    $growth = $response->json('data.growth');
    expect($growth)->toHaveCount(30);
    expect($growth[0]['date'])->toBe(now()->subDays(29)->toDateString());
    expect($growth[29]['date'])->toBe(now()->toDateString());
    expect(collect($growth)->sum('new_users'))->toBeGreaterThanOrEqual(1);
});
```

Also update the existing `'returns platform-wide stats to an admin'` test's `assertJsonStructure` call to include the two new top-level keys:

```php
->assertJsonStructure(['data' => ['users', 'workspaces', 'epks', 'media', 'contacts', 'analytics', 'billing', 'growth']]);
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd backend && php vendor/bin/pest tests/Feature/Admin/AdminPanelTest.php -v`
Expected: the new tests FAIL (no `billing`/`growth` keys exist yet), and the updated `assertJsonStructure` test FAILS too.

- [ ] **Step 3: Add prices to `config/plans.php`**

In `backend/config/plans.php`, add two keys to each of the three plan arrays (`starter`, `pro`, `business`), directly after each plan's existing `'stripe_price_id_yearly'` line:

```php
// starter:
'price_monthly' => 6.66,
'price_yearly_effective_monthly' => 5.55,

// pro:
'price_monthly' => 26.66,
'price_yearly_effective_monthly' => 22.22,

// business:
'price_monthly' => 99.99,
'price_yearly_effective_monthly' => 83.33,
```

These must exactly match `frontend/src/lib/planPricing.ts`'s `PLAN_PRICING` constant (`monthly`/`yearlyEffectiveMonthly` per plan) — transcribe from that file, don't recompute.

- [ ] **Step 4: Create `AdminBillingStats`**

Create `backend/app/Services/AdminBillingStats.php`:

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

- [ ] **Step 5: Create `AdminGrowthStats`**

Create `backend/app/Services/AdminGrowthStats.php`:

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

- [ ] **Step 6: Wire both services into `AdminStatsController`**

Replace the full contents of `backend/app/Http/Controllers/Api/Admin/AdminStatsController.php`:

```php
<?php

namespace App\Http\Controllers\Api\Admin;

use App\Enums\AnalyticsEventType;
use App\Enums\EpkStatus;
use App\Http\Controllers\Controller;
use App\Models\AnalyticsEvent;
use App\Models\Contact;
use App\Models\Epk;
use App\Models\Media;
use App\Models\User;
use App\Models\Workspace;
use App\Services\AdminBillingStats;
use App\Services\AdminGrowthStats;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Cache;

class AdminStatsController extends Controller
{
    public function __construct(
        private readonly AdminBillingStats $billingStats,
        private readonly AdminGrowthStats $growthStats,
    ) {}

    public function index(): JsonResponse
    {
        // A handful of COUNT/SUM scans across the whole platform on every
        // dashboard load — fine at this app's scale today, but cheap to cap
        // regardless. A minute of staleness is a non-issue for a stats
        // dashboard, and the file cache driver (this project's default,
        // chosen for shared hosting with no Redis) makes this a plain local
        // read on every request after the first.
        $data = Cache::remember('admin.stats', 60, fn () => [
            'users' => [
                'total' => User::count(),
                'new_last_7_days' => User::where('created_at', '>=', now()->subDays(7))->count(),
                'new_last_30_days' => User::where('created_at', '>=', now()->subDays(30))->count(),
            ],
            'workspaces' => ['total' => Workspace::count()],
            'epks' => [
                'total' => Epk::count(),
                'published' => Epk::where('status', EpkStatus::Published)->count(),
                'draft' => Epk::where('status', EpkStatus::Draft)->count(),
                'archived' => Epk::where('status', EpkStatus::Archived)->count(),
            ],
            'media' => [
                'total' => Media::count(),
                'storage_bytes' => (int) Media::sum('size'),
            ],
            'contacts' => ['total' => Contact::count()],
            'analytics' => [
                'total_page_views' => AnalyticsEvent::where('type', AnalyticsEventType::PageView)->count(),
                'page_views_last_30_days' => AnalyticsEvent::where('type', AnalyticsEventType::PageView)
                    ->where('created_at', '>=', now()->subDays(30))
                    ->count(),
            ],
            'billing' => $this->billingStats->summarize(),
            'growth' => $this->growthStats->dailyGrowth(),
        ]);

        return response()->json(['data' => $data]);
    }
}
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `cd backend && php vendor/bin/pest tests/Feature/Admin/AdminPanelTest.php -v`
Expected: all tests in the file PASS.

- [ ] **Step 8: Pint**

Run: `cd backend && vendor/bin/pint config/plans.php app/Services/AdminBillingStats.php app/Services/AdminGrowthStats.php app/Http/Controllers/Api/Admin/AdminStatsController.php tests/Feature/Admin/AdminPanelTest.php`
Then: `vendor/bin/pint --test app/ tests/ config/` to confirm clean.

- [ ] **Step 9: Commit**

```bash
git add backend/config/plans.php backend/app/Services/AdminBillingStats.php backend/app/Services/AdminGrowthStats.php backend/app/Http/Controllers/Api/Admin/AdminStatsController.php backend/tests/Feature/Admin/AdminPanelTest.php
git commit -m "Add billing/revenue and growth stats to the admin dashboard"
```

---

### Task 2: Backend — recent activity feed

**Files:**
- Create: `backend/app/Http/Controllers/Api/Admin/AdminActivityController.php`
- Modify: `backend/routes/api.php`
- Test: `backend/tests/Feature/Admin/AdminPanelTest.php` (extend)

**Interfaces:**
- Produces: `GET /api/admin/activity` → `{"data": [{kind: 'user_signed_up'|'workspace_created', label: string, detail: string|null, created_at: string}, ...]}`, newest first, capped at 10 total.

- [ ] **Step 1: Write the failing tests**

Append to `backend/tests/Feature/Admin/AdminPanelTest.php`:

```php
it('denies admin activity to a non-admin', function () {
    $user = User::factory()->create();

    $this->actingAs($user)->getJson('/api/admin/activity')->assertForbidden();
});

it('interleaves recent signups and workspace creations by date, newest first, capped at 10', function () {
    $admin = User::factory()->admin()->create();

    $oldUser = User::factory()->create(['name' => 'Old User', 'created_at' => now()->subDays(5)]);
    $newWorkspace = Workspace::factory()->create(['name' => 'New Workspace', 'created_by' => $oldUser->id, 'created_at' => now()->subDay()]);
    $newestUser = User::factory()->create(['name' => 'Newest User', 'created_at' => now()]);

    $response = $this->actingAs($admin)->getJson('/api/admin/activity');

    $response->assertOk();
    $activity = $response->json('data');
    expect($activity[0])->toMatchArray(['kind' => 'user_signed_up', 'label' => 'Newest User']);
    expect($activity[1])->toMatchArray(['kind' => 'workspace_created', 'label' => 'New Workspace']);
    expect(count($activity))->toBeLessThanOrEqual(10);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd backend && php vendor/bin/pest tests/Feature/Admin/AdminPanelTest.php -v`
Expected: both new tests FAIL with a 404 (route doesn't exist yet).

- [ ] **Step 3: Create `AdminActivityController`**

Create `backend/app/Http/Controllers/Api/Admin/AdminActivityController.php`:

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
     * it tracks admin/moderation and content actions, not platform growth
     * events) and not cached: this is a short, cheap query an admin expects
     * to be fresh on every load, unlike the heavier 60s-cached stats blob.
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

- [ ] **Step 4: Add the route**

In `backend/routes/api.php`, inside the existing `Route::middleware(['auth:sanctum', 'active', 'tokens-enabled', 'admin'])->prefix('admin')->group(function () { ... })` block (around line 250), add:

```php
Route::get('/activity', [AdminActivityController::class, 'index']);
```

Add `use App\Http\Controllers\Api\Admin\AdminActivityController;` to the file's imports if not already grouped with the other `Api\Admin\*` controller imports.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd backend && php vendor/bin/pest tests/Feature/Admin/AdminPanelTest.php -v`
Expected: all tests in the file PASS.

- [ ] **Step 6: Pint**

Run: `cd backend && vendor/bin/pint app/Http/Controllers/Api/Admin/AdminActivityController.php routes/api.php tests/Feature/Admin/AdminPanelTest.php`
Then: `vendor/bin/pint --test app/ tests/ routes/` to confirm clean.

- [ ] **Step 7: Commit**

```bash
git add backend/app/Http/Controllers/Api/Admin/AdminActivityController.php backend/routes/api.php backend/tests/Feature/Admin/AdminPanelTest.php
git commit -m "Add a recent-activity endpoint (signups + workspaces) to the admin panel"
```

---

### Task 3: Backend — subscription status on the admin workspaces list

**Files:**
- Modify: `backend/app/Http/Controllers/Api/Admin/AdminWorkspaceController.php`
- Test: `backend/tests/Feature/Admin/AdminPanelTest.php` (extend)

**Interfaces:**
- `GET /api/admin/workspaces`'s existing per-row response gains `subscription_status` and `access_ends_at`, alongside the existing `id`/`name`/`slug`/`members_count`/`epks_count`/`plan`/`creator`/`created_at` fields.

- [ ] **Step 1: Write the failing test**

Extend the existing `'lets an admin list and delete workspaces'` test in `backend/tests/Feature/Admin/AdminPanelTest.php` — add assertions right after the existing `assertJsonPath('data.0.members_count', 1)` line, before the `deleteJson` call:

```php
    ->assertJsonPath('data.0.subscription_status', 'trialing')
    ->assertJsonPath('data.0.access_ends_at', $workspace->subscription->fresh()->trial_ends_at->toJSON());
```

(The workspace in this test is freshly created via `Workspace::factory()->create()`, so its auto-created subscription is still `Trialing` with `trial_ends_at` set — `PlanLimits::accessEndsAt()` returns exactly that value for a trialing workspace, per its existing `match` arm.)

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && php vendor/bin/pest tests/Feature/Admin/AdminPanelTest.php -v`
Expected: FAIL — the response currently has no `subscription_status`/`access_ends_at` keys.

- [ ] **Step 3: Add the fields**

In `backend/app/Http/Controllers/Api/Admin/AdminWorkspaceController.php`, add a constructor and the two new mapped fields. Add `use App\Services\PlanLimits;` to the imports, then:

```php
class AdminWorkspaceController extends Controller
{
    public function __construct(private readonly PlanLimits $planLimits) {}

    public function index(Request $request): JsonResponse
    {
        $workspaces = Workspace::query()
            ->withCount(['members', 'epks'])
            ->with(['creator:id,name,email', 'subscription'])
            ->when($request->string('search')->trim()->isNotEmpty(), function ($query) use ($request) {
                $query->where('name', 'like', '%'.$request->string('search')->trim().'%');
            })
            ->orderByDesc('created_at')
            ->paginate(25);

        return response()->json([
            'data' => $workspaces->through(fn (Workspace $workspace) => [
                'id' => $workspace->id,
                'name' => $workspace->name,
                'slug' => $workspace->slug,
                'members_count' => $workspace->members_count,
                'epks_count' => $workspace->epks_count,
                'plan' => $workspace->subscription?->plan,
                'subscription_status' => $workspace->subscription?->status,
                'access_ends_at' => $this->planLimits->accessEndsAt($workspace),
                'creator' => $workspace->creator ? ['id' => $workspace->creator->id, 'name' => $workspace->creator->name] : null,
                'created_at' => $workspace->created_at,
            ])->items(),
            'meta' => [
                'current_page' => $workspaces->currentPage(),
                'last_page' => $workspaces->lastPage(),
                'total' => $workspaces->total(),
            ],
        ]);
    }

    // ...destroy() and updateSubscription() below unchanged...
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd backend && php vendor/bin/pest tests/Feature/Admin/AdminPanelTest.php -v`
Expected: all tests in the file PASS.

- [ ] **Step 5: Pint**

Run: `cd backend && vendor/bin/pint app/Http/Controllers/Api/Admin/AdminWorkspaceController.php tests/Feature/Admin/AdminPanelTest.php`
Then: `vendor/bin/pint --test app/ tests/` to confirm clean.

- [ ] **Step 6: Commit**

```bash
git add backend/app/Http/Controllers/Api/Admin/AdminWorkspaceController.php backend/tests/Feature/Admin/AdminPanelTest.php
git commit -m "Surface subscription status inline on the admin workspaces list"
```

---

### Task 4: Frontend — wire the Admin Dashboard to billing/growth/activity

**Files:**
- Modify: `frontend/src/types/index.ts`
- Modify: `frontend/src/api/admin.ts`
- Modify: `frontend/src/features/admin/hooks/useAdmin.ts`
- Create: `frontend/src/features/admin/components/AdminGrowthChart.tsx`
- Create: `frontend/src/features/admin/components/AdminActivityFeed.tsx`
- Modify: `frontend/src/features/admin/pages/AdminDashboardPage.tsx`
- Modify: `frontend/src/i18n/locales/{en,fr,es,pt,de,ar,zh}.json`
- Test: `frontend/src/features/admin/pages/AdminDashboardPage.test.tsx` (new)

**Interfaces:**
- Consumes: `GET /api/admin/stats`'s new `billing`/`growth` keys (Task 1), `GET /api/admin/activity` (Task 2).
- Produces: `getAdminActivity(): Promise<AdminActivityEntry[]>`, `useAdminActivity(): UseQueryResult<AdminActivityEntry[]>`.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/features/admin/pages/AdminDashboardPage.test.tsx`:

```typescript
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { AdminDashboardPage } from '@/features/admin/pages/AdminDashboardPage'
import { server } from '@/test/server'

const API_URL = 'http://localhost:8000'

function statsResponse(overrides: Record<string, unknown> = {}) {
  return {
    data: {
      users: { total: 42, new_last_7_days: 3, new_last_30_days: 10 },
      workspaces: { total: 20 },
      epks: { total: 30, published: 15, draft: 10, archived: 5 },
      media: { total: 100, storage_bytes: 1024 },
      contacts: { total: 50 },
      analytics: { total_page_views: 500, page_views_last_30_days: 200 },
      billing: {
        mrr: 48.88,
        active_by_plan: { starter: 1, pro: 2, business: 0 },
        by_status: { trialing: 5, active: 3, past_due: 0, unpaid: 0, canceled: 1 },
        trial_conversion_rate: 33.3,
        canceled_last_30_days: 1,
      },
      growth: Array.from({ length: 30 }, (_, i) => ({
        date: new Date(Date.now() - (29 - i) * 86400000).toISOString().slice(0, 10),
        new_users: i === 29 ? 2 : 0,
        new_workspaces: i === 29 ? 1 : 0,
      })),
      ...overrides,
    },
  }
}

function activityResponse() {
  return {
    data: [
      { kind: 'user_signed_up', label: 'Ada Lovelace', detail: 'ada@example.com', created_at: new Date().toISOString() },
      { kind: 'workspace_created', label: 'Acme Records', detail: 'Ada Lovelace', created_at: new Date().toISOString() },
    ],
  }
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <AdminDashboardPage />
    </QueryClientProvider>
  )
}

describe('AdminDashboardPage', () => {
  it('shows MRR, trial conversion rate, and cancellations', async () => {
    server.use(
      http.get(`${API_URL}/api/admin/stats`, () => HttpResponse.json(statsResponse())),
      http.get(`${API_URL}/api/admin/activity`, () => HttpResponse.json(activityResponse()))
    )

    renderPage()

    expect(await screen.findByText('€48.88')).toBeInTheDocument()
    expect(screen.getByText('33.3%')).toBeInTheDocument()
  })

  it('shows the active-by-plan breakdown', async () => {
    server.use(
      http.get(`${API_URL}/api/admin/stats`, () => HttpResponse.json(statsResponse())),
      http.get(`${API_URL}/api/admin/activity`, () => HttpResponse.json(activityResponse()))
    )

    renderPage()

    await screen.findByText('€48.88')
    expect(screen.getByText('Starter')).toBeInTheDocument()
  })

  it('shows recent activity entries for both signups and workspace creations', async () => {
    server.use(
      http.get(`${API_URL}/api/admin/stats`, () => HttpResponse.json(statsResponse())),
      http.get(`${API_URL}/api/admin/activity`, () => HttpResponse.json(activityResponse()))
    )

    renderPage()

    // Regexes scoped tightly enough not to collide: activityResponse()'s
    // "Ada Lovelace" appears in BOTH rows (once as the signup label, once
    // as the workspace's creator name), so a bare /Ada Lovelace/ matches
    // two elements and findByText throws "found multiple elements" --
    // match each row's full, distinguishing sentence instead.
    expect(await screen.findByText(/Ada Lovelace signed up/)).toBeInTheDocument()
    expect(await screen.findByText(/Acme Records/)).toBeInTheDocument()
  })

  it('shows an empty state when there is no recent activity', async () => {
    server.use(
      http.get(`${API_URL}/api/admin/stats`, () => HttpResponse.json(statsResponse())),
      http.get(`${API_URL}/api/admin/activity`, () => HttpResponse.json({ data: [] }))
    )

    renderPage()

    await screen.findByText('€48.88')
    expect(await screen.findByText(/No recent activity/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npx vitest run src/features/admin/pages/AdminDashboardPage.test.tsx`
Expected: FAIL on every test — none of the billing/growth/activity UI exists yet.

- [ ] **Step 3: Add types**

In `frontend/src/types/index.ts`, extend `AdminStats` and add `AdminActivityEntry`:

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

(`SubscriptionPlan`/`SubscriptionStatus` are already defined elsewhere in this file — no new import needed within the same file.)

- [ ] **Step 4: Add `getAdminActivity`**

In `frontend/src/api/admin.ts`, add (following the file's existing `getAdminStats` pattern):

```typescript
export async function getAdminActivity(): Promise<AdminActivityEntry[]> {
  const { data } = await apiClient.get<ApiResource<AdminActivityEntry[]>>('/api/admin/activity')
  return data.data
}
```

Add `AdminActivityEntry` to this file's existing type import from `@/types`.

- [ ] **Step 5: Add `useAdminActivity`**

In `frontend/src/features/admin/hooks/useAdmin.ts`, add `getAdminActivity` to the existing import from `@/api/admin`, then add:

```typescript
export function useAdminActivity() {
  return useQuery({ queryKey: ['admin', 'activity'], queryFn: getAdminActivity })
}
```

- [ ] **Step 6: Create `AdminGrowthChart.tsx`**

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

- [ ] **Step 7: Create `AdminActivityFeed.tsx`**

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

- [ ] **Step 8: Wire it into `AdminDashboardPage.tsx`**

Add imports:

```typescript
import { formatEuro } from '@/lib/planPricing'
import { BreakdownCard } from '@/features/analytics/components/BreakdownCard'
import { AdminActivityFeed } from '@/features/admin/components/AdminActivityFeed'
import { AdminGrowthChart } from '@/features/admin/components/AdminGrowthChart'
```

`Card`/`CardHeader`/`CardTitle`/`CardContent` are not currently imported in this file (it only uses `StatTile` inline via the shared grid) — add `import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'` for the new billing tiles block.

After the existing storage-used card's closing `</div>`, and before the end of the returned JSX, add:

```tsx
<div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
  <Card>
    <CardHeader className="pb-2">
      <CardTitle className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{t('admin.dashboard.billing.mrr')}</CardTitle>
    </CardHeader>
    <CardContent className="font-heading text-2xl font-semibold text-foreground">{formatEuro(stats.billing.mrr)}</CardContent>
  </Card>
  <Card>
    <CardHeader className="pb-2">
      <CardTitle className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{t('admin.dashboard.billing.trialConversionRate')}</CardTitle>
    </CardHeader>
    <CardContent className="font-heading text-2xl font-semibold text-foreground">{stats.billing.trial_conversion_rate}%</CardContent>
  </Card>
  <Card>
    <CardHeader className="pb-2">
      <CardTitle className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{t('admin.dashboard.billing.canceledLast30Days')}</CardTitle>
    </CardHeader>
    <CardContent className="font-heading text-2xl font-semibold text-foreground">{stats.billing.canceled_last_30_days}</CardContent>
  </Card>
</div>

<BreakdownCard
  title={t('admin.dashboard.billing.activeByPlan')}
  emptyLabel={t('admin.dashboard.growth.empty')}
  rows={[
    { label: t('admin.workspaces.planStarter'), count: stats.billing.active_by_plan.starter },
    { label: t('admin.workspaces.planPro'), count: stats.billing.active_by_plan.pro },
    { label: t('admin.workspaces.planBusiness'), count: stats.billing.active_by_plan.business },
  ]}
/>

<AdminGrowthChart points={stats.growth} />

<AdminActivityFeed />
```

(`stats` is the existing `data` returned by `useAdminStats()` in this file — check the current variable name at the top of the component and use that, not necessarily literally `stats`.)

- [ ] **Step 9: Add the i18n keys**

Write a one-off Node script (in the scratchpad directory) that, for each of the 7 locale files, extends the existing `admin.dashboard` object. Anchor on `"storageUsed": "Storage used"` (its exact translated value differs per locale — grep each file first: `grep -o '"storageUsed": "[^"]*"' frontend/src/i18n/locales/<loc>.json`) followed by its closing `}` before `"pagination": {`. Insert `billing`, `growth`, and `activity` sub-objects as new siblings inside `admin.dashboard`, after `storageUsed`. Use these translations:

| Key | en | fr | es | pt | de | ar | zh |
|---|---|---|---|---|---|---|---|
| `billing.mrr` | Monthly recurring revenue | Revenu mensuel récurrent | Ingresos recurrentes mensuales | Receita recorrente mensal | Monatlich wiederkehrender Umsatz | الإيراد الشهري المتكرر | 每月经常性收入 |
| `billing.activeByPlan` | Active subscribers by plan | Abonnés actifs par forfait | Suscriptores activos por plan | Assinantes ativos por plano | Aktive Abonnenten nach Tarif | المشتركون النشطون حسب الخطة | 按套餐划分的活跃订阅者 |
| `billing.trialConversionRate` | Trial → paid conversion | Conversion essai → payant | Conversión de prueba a pago | Conversão de teste para pago | Testphase-zu-Bezahlt-Konversion | تحويل التجربة إلى مدفوع | 试用转付费转化率 |
| `billing.canceledLast30Days` | Canceled (30d) | Résiliés (30j) | Cancelados (30d) | Cancelados (30d) | Gekündigt (30T) | ملغى (30 يومًا) | 已取消（30天） |
| `growth.title` | Growth | Croissance | Crecimiento | Crescimento | Wachstum | النمو | 增长 |
| `growth.newUsers` | New users | Nouveaux utilisateurs | Nuevos usuarios | Novos utilizadores | Neue Nutzer | مستخدمون جدد | 新用户 |
| `growth.newWorkspaces` | New workspaces | Nouveaux espaces de travail | Nuevos espacios de trabajo | Novos espaços de trabalho | Neue Arbeitsbereiche | مساحات عمل جديدة | 新工作区 |
| `growth.empty` | No growth data yet. | Aucune donnée de croissance pour le moment. | Aún no hay datos de crecimiento. | Ainda não há dados de crescimento. | Noch keine Wachstumsdaten. | لا توجد بيانات نمو بعد. | 暂无增长数据。 |
| `activity.title` | Recent activity | Activité récente | Actividad reciente | Atividade recente | Letzte Aktivität | النشاط الأخير | 近期动态 |
| `activity.empty` | No recent activity yet. | Aucune activité récente pour le moment. | Aún no hay actividad reciente. | Ainda não há atividade recente. | Noch keine Aktivität. | لا يوجد نشاط حديث بعد. | 暂无近期动态。 |
| `activity.signedUp` | {{name}} signed up | {{name}} s'est inscrit(e) | {{name}} se registró | {{name}} registou-se | {{name}} hat sich registriert | انضم {{name}} | {{name}} 已注册 |
| `activity.workspaceCreated` | {{creator}} created "{{name}}" | {{creator}} a créé « {{name}} » | {{creator}} creó "{{name}}" | {{creator}} criou "{{name}}" | {{creator}} hat "{{name}}" erstellt | أنشأ {{creator}} "{{name}}" | {{creator}} 创建了「{{name}}」 |

After running the script, validate every file: `node -e "JSON.parse(require('fs').readFileSync('src/i18n/locales/en.json','utf8'))"` (repeat for all 7).

- [ ] **Step 10: Run the test to verify it passes**

Run: `cd frontend && npx vitest run src/features/admin/pages/AdminDashboardPage.test.tsx`
Expected: all 4 tests PASS.

- [ ] **Step 11: Run the full frontend verification**

Run: `cd frontend && npx tsc -b --noEmit && npx vitest run && npx oxlint src/features/admin src/api/admin.ts src/types/index.ts && npm run build`
Expected: clean typecheck, full suite green (including everything from the Workspace Dashboard feature — this task must not break anything), no new lint warnings, build succeeds.

- [ ] **Step 12: Commit**

```bash
git add frontend/src/types/index.ts frontend/src/api/admin.ts frontend/src/features/admin frontend/src/i18n/locales
git commit -m "Wire the Admin Dashboard to real billing, growth, and activity data"
```

---

### Task 5: Frontend — subscription status column on the admin workspaces table

**Files:**
- Modify: `frontend/src/types/index.ts`
- Modify: `frontend/src/features/admin/pages/AdminWorkspacesPage.tsx`
- Modify: `frontend/src/i18n/locales/{en,fr,es,pt,de,ar,zh}.json`
- Test: `frontend/src/features/admin/pages/AdminWorkspacesPage.test.tsx` (new, unless one already exists — check first with `find frontend/src/features/admin -iname "*Workspaces*test*"`; extend it instead of creating a duplicate if it does)

**Interfaces:**
- Consumes: `GET /api/admin/workspaces`'s new `subscription_status`/`access_ends_at` fields (Task 3).

- [ ] **Step 1: Check for an existing test file, then write the failing test(s)**

Run `find frontend/src/features/admin -iname "*Workspaces*test*"` first. If none exists, create `frontend/src/features/admin/pages/AdminWorkspacesPage.test.tsx`:

```typescript
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { AdminWorkspacesPage } from '@/features/admin/pages/AdminWorkspacesPage'
import { server } from '@/test/server'

const API_URL = 'http://localhost:8000'

function workspacesResponse(status: string) {
  return {
    data: [
      {
        id: 1,
        name: 'Acme Records',
        slug: 'acme-records',
        members_count: 3,
        epks_count: 2,
        plan: 'pro',
        subscription_status: status,
        access_ends_at: null,
        creator: { id: 1, name: 'Ada Lovelace' },
        created_at: '2026-01-01T00:00:00.000000Z',
      },
    ],
    meta: { current_page: 1, last_page: 1, total: 1 },
  }
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <AdminWorkspacesPage />
    </QueryClientProvider>
  )
}

describe('AdminWorkspacesPage', () => {
  it('shows the subscription status for each workspace', async () => {
    server.use(http.get(`${API_URL}/api/admin/workspaces`, () => HttpResponse.json(workspacesResponse('active'))))

    renderPage()

    expect(await screen.findByText('Active')).toBeInTheDocument()
  })

  it('shows a canceled workspace with a distinct destructive-styled badge', async () => {
    server.use(http.get(`${API_URL}/api/admin/workspaces`, () => HttpResponse.json(workspacesResponse('canceled'))))

    renderPage()

    const badge = await screen.findByText('Canceled')
    expect(badge.className).toMatch(/destructive/)
  })
})
```

If an existing test file for this page IS found instead, add these two `it(...)` blocks into it following its existing conventions (mock shape, render helper) rather than duplicating the file's setup.

- [ ] **Step 2: Run the test(s) to verify they fail**

Run: `cd frontend && npx vitest run src/features/admin/pages/AdminWorkspacesPage.test.tsx`
Expected: FAIL — no status column exists yet.

- [ ] **Step 3: Add the two fields to `AdminWorkspace`**

In `frontend/src/types/index.ts`:

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

- [ ] **Step 4: Add the status column**

In `frontend/src/features/admin/pages/AdminWorkspacesPage.tsx`:

Add `import { Badge } from '@/components/ui/badge'` to the imports.

Add a status-label + variant helper near the top of the file (module scope, alongside the existing `planItems` function):

```typescript
const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  trialing: 'default',
  active: 'secondary',
  past_due: 'outline',
  unpaid: 'destructive',
  canceled: 'destructive',
}
```

In `WorkspaceRow`, add a new `<TableCell>` between the existing plan `<TableCell>` and the created-date `<TableCell>`:

```tsx
<TableCell>
  {workspace.subscription_status && (
    <Badge variant={STATUS_VARIANT[workspace.subscription_status]}>
      {t(`admin.workspaces.statusLabels.${workspace.subscription_status}`)}
    </Badge>
  )}
</TableCell>
```

Add the matching `<TableHead>{t('admin.workspaces.columns.subscriptionStatus')}</TableHead>` in the table header, in the same column position (between the `plan` head and the `created` head).

- [ ] **Step 5: Add the i18n keys**

Extend the same scratchpad Node script from Task 4 (or a small follow-up script) to also touch `admin.workspaces.columns` (anchor: `"created": "Created"` followed by its closing `}` before `"epks": {`) and add a new `admin.workspaces.statusLabels` sibling object. Translations:

| Key | en | fr | es | pt | de | ar | zh |
|---|---|---|---|---|---|---|---|
| `columns.subscriptionStatus` | Status | Statut | Estado | Estado | Status | الحالة | 状态 |
| `statusLabels.trialing` | Trialing | Essai | En prueba | Em teste | Testphase | تجريبي | 试用中 |
| `statusLabels.active` | Active | Actif | Activo | Ativo | Aktiv | نشط | 活跃 |
| `statusLabels.past_due` | Past due | Impayé | Vencido | Em atraso | Überfällig | متأخر السداد | 逾期 |
| `statusLabels.unpaid` | Unpaid | Non payé | Impagado | Não pago | Unbezahlt | غير مدفوع | 未付款 |
| `statusLabels.canceled` | Canceled | Résilié | Cancelado | Cancelado | Gekündigt | ملغى | 已取消 |

Validate every file with `JSON.parse` after.

- [ ] **Step 6: Run the test(s) to verify they pass**

Run: `cd frontend && npx vitest run src/features/admin/pages/AdminWorkspacesPage.test.tsx`
Expected: both new tests PASS (and every pre-existing test in the file, if it already existed).

- [ ] **Step 7: Run the full frontend verification**

Run: `cd frontend && npx tsc -b --noEmit && npx vitest run && npx oxlint src/features/admin src/types/index.ts && npm run build`
Expected: clean typecheck, full suite green, no new lint warnings, build succeeds.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/types/index.ts frontend/src/features/admin frontend/src/i18n/locales
git commit -m "Show subscription status inline on the admin workspaces table"
```

---

## After all tasks: mirror to split repos, do not push

Per this project's established process: `cp` every changed file from `epk/backend/`/`epk/frontend/` into `epk-back/`/`epk-front/` (stripping the `backend/`/`frontend/` prefix), rebuild the frontend (`npm run build`) and copy the new hashed `dist/assets/*` + `dist/index.html` into `epk-front/dist/`, then commit (same message) to all three repos. **Do not push** — push only happens on an explicit "push it" from the user.
