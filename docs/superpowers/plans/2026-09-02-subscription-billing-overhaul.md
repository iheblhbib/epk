# Subscription Billing Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current Free/Pro/Business flat-price billing model with a Haulix-style system: no permanent free tier, a 14-day full-access trial for every new workspace, three paid packs (Starter/Pro/Business) each billed monthly or annually, and a hard lockout of the entire app (except Billing) once the trial ends with no active paid subscription.

**Architecture:** Rename the `free` plan to `starter` throughout (enum, config, tests) rather than adding a fourth tier. Trial state lives on the existing `Subscription` row via two new columns (`trial_ends_at`, `billing_interval`) — no new tables. A single new middleware, generic over route-bound models via each model's existing `workspace()` relation, gates access; `PlanLimits` itself is untouched in shape, since a trialing workspace's `plan` column is simply set to `Business` at creation, so existing limit-checking code needs no trial-awareness. Stripe integration goes from one price per plan to two (monthly/yearly), reverse-looked-up together instead of separately.

**Tech Stack:** Laravel 12 / Pest (backend), React 19 / TypeScript / Vitest (frontend), Stripe SDK (already integrated, no new packages).

**Spec:** `docs/superpowers/specs/2026-09-02-subscription-billing-overhaul-design.md`

## Global Constraints

- No real users exist yet on the current Free plan — this is a clean-slate change, not a data migration. `php artisan migrate:fresh --seed` is expected locally/in test after this ships.
- Trial: exactly 14 days, no payment method collected at signup, full `Business`-tier limits during the trial.
- Lockout on trial expiry (or subscription cancellation) with no active paid plan: hard block on every workspace-scoped route except `GET/POST /workspaces/{workspace}/billing*`. No read-only fallback.
- Three packs only — Starter/Pro/Business. No fourth tier, no Haulix "Pro+"/Custom tier.
- Prices (EUR): Starter €6.66/mo or €5.55/mo billed annually (€66.60/yr). Pro €26.66/mo or €22.22/mo billed annually (€266.64/yr). Business €99.99/mo or €83.33/mo billed annually (€999.96/yr). Annual is a genuine Stripe yearly-interval price, not a monthly price with a coupon.
- Limits: Starter — 150 MB storage, 3 EPKs, 2 team members, no custom themes/private links/custom domains. Pro — 2 GB storage, 10 EPKs, 10 team members, custom themes + private links, no custom domains. Business — 20 GB storage, unlimited EPKs, unlimited team members, everything unlocked (custom themes, private links, custom domains, white-label flag).

---

## Task 1: Rename the Free plan to Starter, add Trialing status

**Files:**
- Modify: `backend/app/Enums/SubscriptionPlan.php`
- Modify: `backend/app/Enums/SubscriptionStatus.php`
- Test: `backend/tests/Unit/Services/PlanLimitsTest.php`

**Interfaces:**
- Produces: `SubscriptionPlan::Starter` (replaces `SubscriptionPlan::Free`, value `'starter'`), `SubscriptionStatus::Trialing` (value `'trialing'`) — every later task reads these.

- [ ] **Step 1: Write the failing test**

Replace the whole file `backend/tests/Unit/Services/PlanLimitsTest.php` with:

```php
<?php

use App\Enums\SubscriptionPlan;
use App\Models\Artist;
use App\Models\Epk;
use App\Models\Workspace;
use App\Models\WorkspaceMember;
use App\Services\PlanLimits;

beforeEach(function () {
    $this->limits = new PlanLimits;
});

it('defaults to the starter plan when a subscription somehow has no plan set', function () {
    $workspace = Workspace::factory()->create();
    $workspace->subscription()->update(['plan' => null]);

    expect($this->limits->plan($workspace->fresh()))->toBe(SubscriptionPlan::Starter);
});

it('applies starter plan limits', function () {
    $workspace = Workspace::factory()->create();
    $workspace->subscription()->update(['plan' => SubscriptionPlan::Starter]);

    expect($this->limits->maxEpks($workspace))->toBe(3);
    expect($this->limits->maxTeamMembers($workspace))->toBe(2);
    expect($this->limits->canUseCustomThemes($workspace))->toBeFalse();
    expect($this->limits->canUsePrivateLinks($workspace))->toBeFalse();
});

it('treats a null limit as unlimited', function () {
    $workspace = Workspace::factory()->create();
    $workspace->subscription()->update(['plan' => SubscriptionPlan::Business]);

    expect($this->limits->maxEpks($workspace))->toBeNull();
    expect($this->limits->maxTeamMembers($workspace))->toBeNull();
    expect($this->limits->remainingStorageBytes($workspace))->not->toBeNull(); // Business still caps storage
});

it('allows creating up to, but not at, the epk limit', function () {
    $workspace = Workspace::factory()->create();
    $workspace->subscription()->update(['plan' => SubscriptionPlan::Starter]); // max_epks = 3
    $artist = Artist::factory()->create(['workspace_id' => $workspace->id]);
    Epk::factory()->count(3)->create(['workspace_id' => $workspace->id, 'artist_id' => $artist->id]);

    expect($this->limits->canCreateEpk($workspace))->toBeFalse();
});

it('counts existing members (including the owner) toward the team member limit', function () {
    $workspace = Workspace::factory()->create();
    $workspace->subscription()->update(['plan' => SubscriptionPlan::Starter]); // max_team_members = 2
    $owner = WorkspaceMember::factory()->for($workspace)->create();

    expect($this->limits->canAddTeamMember($workspace))->toBeTrue();

    WorkspaceMember::factory()->for($workspace)->create();

    expect($this->limits->canAddTeamMember($workspace))->toBeFalse();
    expect($workspace->members()->count())->toBe(2);
    expect($owner->workspace_id)->toBe($workspace->id);
});

it('computes remaining storage and whether an upload fits', function () {
    $workspace = Workspace::factory()->create();
    $workspace->subscription()->update(['plan' => SubscriptionPlan::Starter]); // 150 MB
    expect($this->limits->remainingStorageBytes($workspace))->toBe(150 * 1024 * 1024);
    expect($this->limits->hasStorageFor($workspace, 100))->toBeTrue();
    expect($this->limits->hasStorageFor($workspace, 150 * 1024 * 1024 + 1))->toBeFalse();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && php artisan test --filter=PlanLimitsTest tests/Unit`
Expected: FAIL — `SubscriptionPlan::Starter` doesn't exist yet (`ValueError` or "Undefined constant").

- [ ] **Step 3: Update the enums**

Replace `backend/app/Enums/SubscriptionPlan.php`:

```php
<?php

namespace App\Enums;

enum SubscriptionPlan: string
{
    case Starter = 'starter';
    case Pro = 'pro';
    case Business = 'business';

    public function label(): string
    {
        return config("plans.{$this->value}.label");
    }
}
```

Replace `backend/app/Enums/SubscriptionStatus.php`:

```php
<?php

namespace App\Enums;

// Mirrors the shape of Stripe subscription statuses relevant to this app.
// Trialing is a purely local concept -- Stripe never sees a subscription
// object at all during the trial (see Workspace::booted()), so it isn't a
// status Stripe itself would ever report back via webhook; it only ever
// gets set once, at workspace creation, and only ever gets read out again,
// never written to by anything Stripe-facing.
enum SubscriptionStatus: string
{
    case Trialing = 'trialing';
    case Active = 'active';
    case Canceled = 'canceled';
    case PastDue = 'past_due';
}
```

Note: `PlanLimits::plan()`'s current fallback (`?? SubscriptionPlan::Free`) still references the old case — this won't compile/run correctly yet. That's fixed in Task 4; this task is just the enum shape.

- [ ] **Step 4: Run the test again to confirm the expected next failure**

Run: `cd backend && php artisan test --filter=PlanLimitsTest tests/Unit`
Expected: FAIL — a different error now, from `PlanLimits.php:17` referencing `SubscriptionPlan::Free`, which no longer exists. This confirms the enum rename took effect and pinpoints exactly what Task 4 fixes.

- [ ] **Step 5: Commit**

```bash
cd backend
git add app/Enums/SubscriptionPlan.php app/Enums/SubscriptionStatus.php tests/Unit/Services/PlanLimitsTest.php
git commit -m "Rename SubscriptionPlan::Free to Starter, add SubscriptionStatus::Trialing"
```

---

## Task 2: Migration — trial and billing-interval columns

**Files:**
- Modify: `backend/database/migrations/2026_09_03_090000_create_subscriptions_table.php`
- Create: `backend/database/migrations/2026_09_12_090000_add_trial_and_billing_interval_to_subscriptions_table.php`

**Interfaces:**
- Produces: `subscriptions.trial_ends_at` (nullable timestamp), `subscriptions.billing_interval` (nullable string) — consumed by Task 3 (Subscription model), Task 5 (Workspace::booted()), Task 7 (access-gate middleware), Task 8 (StripeBillingService).

- [ ] **Step 1: Update the original migration's default plan value**

In `backend/database/migrations/2026_09_03_090000_create_subscriptions_table.php`, find:

```php
$table->string('plan', 20)->default('free');
```

Replace with:

```php
$table->string('plan', 20)->default('starter');
```

(Safe to edit in place rather than adding a follow-up migration: no real data exists yet, per Global Constraints. This keeps a fresh install's column default meaningful instead of pointing at a removed enum case that would throw on cast if anything ever relied on it.)

- [ ] **Step 2: Create the new migration**

Run: `cd backend && php artisan make:migration add_trial_and_billing_interval_to_subscriptions_table --table=subscriptions`

Replace the generated file's contents (adjust the auto-generated filename/class name to match if they differ) — target path `backend/database/migrations/2026_09_12_090000_add_trial_and_billing_interval_to_subscriptions_table.php`:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('subscriptions', function (Blueprint $table) {
            // Set once, at workspace creation, to created_at + 14 days --
            // see Workspace::booted(). Read by the access-gate middleware
            // to decide whether a Trialing subscription still has access.
            $table->timestamp('trial_ends_at')->nullable()->after('status');
            // Populated only once a real paid Stripe subscription exists
            // (see StripeBillingService::syncFromStripeSubscription()) --
            // stays null throughout the trial.
            $table->string('billing_interval', 10)->nullable()->after('trial_ends_at');
        });
    }

    public function down(): void
    {
        Schema::table('subscriptions', function (Blueprint $table) {
            $table->dropColumn(['trial_ends_at', 'billing_interval']);
        });
    }
};
```

- [ ] **Step 3: Run migrations fresh to verify both apply cleanly**

Run: `cd backend && php artisan migrate:fresh`
Expected: all migrations run without error, including the two just touched.

- [ ] **Step 4: Commit**

```bash
cd backend
git add database/migrations/2026_09_03_090000_create_subscriptions_table.php database/migrations/2026_09_12_090000_add_trial_and_billing_interval_to_subscriptions_table.php
git commit -m "Add trial_ends_at and billing_interval columns to subscriptions"
```

---

## Task 3: Subscription model — new fillable/casts

**Files:**
- Modify: `backend/app/Models/Subscription.php`
- Modify: `backend/database/factories/SubscriptionFactory.php`

**Interfaces:**
- Consumes: `subscriptions.trial_ends_at`, `subscriptions.billing_interval` (Task 2)
- Produces: `Subscription::$trial_ends_at` (Carbon), `Subscription::$billing_interval` (string|null) — consumed by Task 5, 7, 8.

- [ ] **Step 1: Update the model**

In `backend/app/Models/Subscription.php`, update `$fillable` and `casts()`:

```php
protected $fillable = [
    'workspace_id',
    'plan',
    'status',
    'stripe_customer_id',
    'stripe_subscription_id',
    'current_period_ends_at',
    'trial_ends_at',
    'billing_interval',
    'canceled_at',
];

protected function casts(): array
{
    return [
        'plan' => SubscriptionPlan::class,
        'status' => SubscriptionStatus::class,
        'current_period_ends_at' => 'datetime',
        'trial_ends_at' => 'datetime',
        'canceled_at' => 'datetime',
    ];
}
```

- [ ] **Step 2: Update the factory**

Replace `backend/database/factories/SubscriptionFactory.php`:

```php
<?php

namespace Database\Factories;

use App\Enums\SubscriptionPlan;
use App\Enums\SubscriptionStatus;
use App\Models\Subscription;
use App\Models\Workspace;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Subscription>
 */
class SubscriptionFactory extends Factory
{
    public function definition(): array
    {
        return [
            'workspace_id' => Workspace::factory(),
            'plan' => SubscriptionPlan::Business,
            'status' => SubscriptionStatus::Trialing,
            'trial_ends_at' => now()->addDays(14),
        ];
    }

    public function plan(SubscriptionPlan $plan): static
    {
        return $this->state(['plan' => $plan]);
    }

    /** An active, paying subscription -- past the trial, no longer time-boxed. */
    public function active(): static
    {
        return $this->state([
            'status' => SubscriptionStatus::Active,
            'trial_ends_at' => null,
            'billing_interval' => 'monthly',
        ]);
    }

    /** A trial that already ran out, with nothing paid -- the locked-out state. */
    public function expiredTrial(): static
    {
        return $this->state([
            'status' => SubscriptionStatus::Trialing,
            'trial_ends_at' => now()->subDay(),
        ]);
    }
}
```

- [ ] **Step 3: No test to run yet** — this factory is exercised by Task 4 and 5's tests. Verify the file has no syntax errors:

Run: `cd backend && php -l app/Models/Subscription.php && php -l database/factories/SubscriptionFactory.php`
Expected: `No syntax errors detected` for both.

- [ ] **Step 4: Commit**

```bash
cd backend
git add app/Models/Subscription.php database/factories/SubscriptionFactory.php
git commit -m "Add trial_ends_at/billing_interval to Subscription model and factory"
```

---

## Task 4: config/plans.php — new tiers, prices, and .env wiring

**Files:**
- Modify: `backend/config/plans.php`
- Modify: `backend/app/Services/PlanLimits.php:17`
- Modify: `backend/.env.example`
- Modify: `backend/phpunit.xml`

**Interfaces:**
- Consumes: `SubscriptionPlan::Starter` (Task 1)
- Produces: `config('plans.starter.*')`, `config('plans.pro.*')`, `config('plans.business.*')`, each with `stripe_price_id_monthly`/`stripe_price_id_yearly` instead of a single `stripe_price_id` — consumed by Task 8 (StripeBillingService).

- [ ] **Step 1: Write the failing test**

Add to `backend/tests/Feature/Billing/PlanLimitsTest.php` (this file gets substantially rewritten in Task 7 alongside the access-gate middleware; for now just add this one assertion at the end to prove the config loads correctly):

```php
it('exposes starter limits and two Stripe price ids per plan from config', function () {
    expect(config('plans.starter.max_epks'))->toBe(3);
    expect(config('plans.starter.max_storage_bytes'))->toBe(150 * 1024 * 1024);
    expect(config('plans.pro.max_storage_bytes'))->toBe(2 * 1024 * 1024 * 1024);
    expect(config('plans.business.max_storage_bytes'))->toBe(20 * 1024 * 1024 * 1024);
    expect(config('plans.starter'))->toHaveKeys(['stripe_price_id_monthly', 'stripe_price_id_yearly']);
    expect(config('plans'))->not->toHaveKey('free');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && php artisan test --filter="exposes starter limits"`
Expected: FAIL — `config('plans.starter.max_epks')` is null, since the `starter` key doesn't exist in config yet (it's still `free`).

- [ ] **Step 3: Replace config/plans.php**

```php
<?php

/*
|--------------------------------------------------------------------------
| Subscription Plans
|--------------------------------------------------------------------------
|
| The static feature/limit table for each plan tier. This is deliberately a
| config file rather than a database table -- these three tiers are product
| decisions, not admin-editable data, much like Stripe Price/Product objects
| aren't edited from inside the app that sells them.
|
| Two Stripe price ids per plan (not one): 'stripe_price_id_monthly' and
| 'stripe_price_id_yearly'. The yearly one is a genuine Stripe recurring
| price with interval=year -- one invoice per year at the discounted
| effective-monthly rate, not a monthly price with a coupon applied twelve
| times. StripeBillingService::createCheckoutSession() picks between the
| two based on which interval the frontend requested.
|
| There is no Free tier. Every new workspace gets a 14-day trial at full
| Business-tier limits (see Workspace::booted()) with no Stripe object
| created at all -- these three configs are only ever read once a real
| Stripe price id needs resolving, either at checkout or from a webhook.
|
| 'white_label' is recorded here as a plan flag but has no enforcement
| point yet -- that feature doesn't exist in the app at all, so there's
| nothing to gate. It's included so the comparison table is honest about
| what each tier is eventually meant to unlock.
|
| 'custom_domains' gates EpkCustomDomainController (see PlanLimits::
| canUseCustomDomains()) -- DNS/SSL for the domain itself is still a manual
| step on the host, this only controls who's allowed to attach one.
|
*/

return [

    'starter' => [
        'label' => 'Starter',
        'max_epks' => 3,
        'max_storage_bytes' => 150 * 1024 * 1024, // 150 MB
        'max_team_members' => 2,
        'custom_themes' => false,
        'private_links' => false,
        'white_label' => false,
        'custom_domains' => false,
        'stripe_price_id_monthly' => env('STRIPE_PRICE_STARTER_MONTHLY'),
        'stripe_price_id_yearly' => env('STRIPE_PRICE_STARTER_YEARLY'),
    ],

    'pro' => [
        'label' => 'Pro',
        'max_epks' => 10,
        'max_storage_bytes' => 2 * 1024 * 1024 * 1024, // 2 GB
        'max_team_members' => 10,
        'custom_themes' => true,
        'private_links' => true,
        'white_label' => false,
        'custom_domains' => false,
        'stripe_price_id_monthly' => env('STRIPE_PRICE_PRO_MONTHLY'),
        'stripe_price_id_yearly' => env('STRIPE_PRICE_PRO_YEARLY'),
    ],

    'business' => [
        'label' => 'Business',
        'max_epks' => null, // unlimited
        'max_storage_bytes' => 20 * 1024 * 1024 * 1024, // 20 GB
        'max_team_members' => null, // unlimited
        'custom_themes' => true,
        'private_links' => true,
        'white_label' => true,
        'custom_domains' => true,
        'stripe_price_id_monthly' => env('STRIPE_PRICE_BUSINESS_MONTHLY'),
        'stripe_price_id_yearly' => env('STRIPE_PRICE_BUSINESS_YEARLY'),
    ],

];
```

- [ ] **Step 4: Update `PlanLimits::plan()`'s fallback**

In `backend/app/Services/PlanLimits.php`, line 17:

```php
    public function plan(Workspace $workspace): SubscriptionPlan
    {
        return $workspace->subscription?->plan ?? SubscriptionPlan::Starter;
    }
```

(Only the enum case name changes, from `Free` to `Starter` -- this fallback is effectively dead code since `Workspace::booted()` guarantees every workspace has a subscription row, same as before.)

- [ ] **Step 5: Update `.env.example`**

In `backend/.env.example`, replace:

```
STRIPE_PRICE_PRO=
STRIPE_PRICE_BUSINESS=
```

with:

```
STRIPE_PRICE_STARTER_MONTHLY=
STRIPE_PRICE_STARTER_YEARLY=
STRIPE_PRICE_PRO_MONTHLY=
STRIPE_PRICE_PRO_YEARLY=
STRIPE_PRICE_BUSINESS_MONTHLY=
STRIPE_PRICE_BUSINESS_YEARLY=
```

- [ ] **Step 6: Update `phpunit.xml`'s fake Stripe env vars**

In `backend/phpunit.xml`, replace the two existing `STRIPE_PRICE_*` `<env>` lines with six, using the same "fake but well-formed" values pattern as the existing `STRIPE_SECRET`/`STRIPE_WEBHOOK_SECRET` entries:

```xml
<env name="STRIPE_PRICE_STARTER_MONTHLY" value="price_test_starter_monthly"/>
<env name="STRIPE_PRICE_STARTER_YEARLY" value="price_test_starter_yearly"/>
<env name="STRIPE_PRICE_PRO_MONTHLY" value="price_test_pro_monthly"/>
<env name="STRIPE_PRICE_PRO_YEARLY" value="price_test_pro_yearly"/>
<env name="STRIPE_PRICE_BUSINESS_MONTHLY" value="price_test_business_monthly"/>
<env name="STRIPE_PRICE_BUSINESS_YEARLY" value="price_test_business_yearly"/>
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `cd backend && php artisan test --filter="exposes starter limits"`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
cd backend
git add config/plans.php app/Services/PlanLimits.php .env.example phpunit.xml tests/Feature/Billing/PlanLimitsTest.php
git commit -m "Restructure plan config: Starter/Pro/Business tiers, monthly+yearly Stripe prices"
```

---

## Task 5: Workspace creation grants a 14-day Business-tier trial

**Files:**
- Modify: `backend/app/Models/Workspace.php:26-32`
- Test: `backend/tests/Feature/Database/SeederTest.php`

**Interfaces:**
- Consumes: `SubscriptionStatus::Trialing`, `SubscriptionPlan::Business` (Task 1), `Subscription::$trial_ends_at` (Task 3)
- Produces: every new `Workspace` has a `Subscription` with `plan=Business, status=Trialing, trial_ends_at=+14 days` -- consumed by Task 7 (access gate).

- [ ] **Step 1: Write the failing test**

Replace `backend/tests/Feature/Database/SeederTest.php`'s first test (leave the rest of the file's other tests alone if it has any beyond what's shown in the current codebase -- if the file contains only the billing-adjacent tests shown below, replace the whole file):

```php
<?php

use App\Enums\SubscriptionPlan;
use App\Enums\SubscriptionStatus;
use App\Enums\WorkspaceRole;
use App\Models\Artist;
use App\Models\Epk;
use App\Models\User;
use App\Models\Workspace;

function billingWorkspaceWithOwner(): array
{
    $owner = User::factory()->create();
    $workspace = Workspace::factory()->create(['created_by' => $owner->id]);
    $workspace->members()->create(['user_id' => $owner->id, 'role' => WorkspaceRole::Owner, 'status' => 'active', 'joined_at' => now()]);

    return [$workspace, $owner];
}

it('gives every new workspace a 14-day full-access trial automatically', function () {
    [$workspace] = billingWorkspaceWithOwner();

    expect($workspace->subscription)->not->toBeNull();
    expect($workspace->subscription->plan)->toBe(SubscriptionPlan::Business);
    expect($workspace->subscription->status)->toBe(SubscriptionStatus::Trialing);
    expect($workspace->subscription->trial_ends_at->diffInDays(now()))->toBeLessThanOrEqual(14)
        ->and($workspace->subscription->trial_ends_at->isFuture())->toBeTrue();
});

it('grants full Business-tier limits during the trial regardless of eventual pack choice', function () {
    [$workspace, $owner] = billingWorkspaceWithOwner();
    $artist = Artist::factory()->create(['workspace_id' => $workspace->id]);
    Epk::factory()->count(5)->create(['workspace_id' => $workspace->id, 'artist_id' => $artist->id]);

    // Starter's own limit is 3 EPKs -- proves the trial isn't capped at
    // whatever tier the workspace might eventually subscribe to.
    $this->actingAs($owner)->postJson('/api/epks', [
        'workspace_id' => $workspace->id,
        'artist_id' => $artist->id,
        'title' => 'Sixth EPK, still fine during trial',
    ])->assertCreated();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && php artisan test --filter=SeederTest`
Expected: FAIL — `$workspace->subscription->plan` is `Starter` (the new column default from Task 2), not `Business`; `status` is the DB default `active`, not `trialing`.

- [ ] **Step 3: Update `Workspace::booted()`**

In `backend/app/Models/Workspace.php`, add the two enum imports at the top and replace the `booted()` method:

```php
use App\Enums\SubscriptionPlan;
use App\Enums\SubscriptionStatus;
```

```php
    protected static function booted(): void
    {
        // Every new workspace gets a 14-day trial at full Business-tier
        // limits, no Stripe interaction at all -- see docs/superpowers/
        // specs/2026-09-02-subscription-billing-overhaul-design.md. The
        // access-gate middleware (EnsureSubscriptionIsActive) is what
        // actually enforces the 14-day cutoff; this just sets it up.
        static::created(function (Workspace $workspace) {
            $workspace->subscription()->create([
                'plan' => SubscriptionPlan::Business,
                'status' => SubscriptionStatus::Trialing,
                'trial_ends_at' => now()->addDays(14),
            ]);
        });
    }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd backend && php artisan test --filter=SeederTest`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd backend
git add app/Models/Workspace.php tests/Feature/Database/SeederTest.php
git commit -m "Grant every new workspace a 14-day full-access trial instead of a Free plan"
```

---

## Task 6: WorkspaceSeeder comment cleanup

**Files:**
- Modify: `backend/database/seeders/WorkspaceSeeder.php`

**Interfaces:**
- Consumes: nothing new (this task only touches a comment, no behavior change).

- [ ] **Step 1: Update the stale comment**

In `backend/database/seeders/WorkspaceSeeder.php`, the comment above `$workspace->subscription()->updateOrCreate([], ['plan' => SubscriptionPlan::Business]);` currently says the workspace would otherwise get "a Free subscription automatically" -- update it to match Task 5's new behavior:

```php
        // A demo/sandbox workspace should showcase every feature indefinitely,
        // not be time-boxed to a 14-day trial like a normal new workspace --
        // it already ships with 3 members and is meant to demo private links,
        // custom themes, etc. `Workspace::booted()` already grants a trial at
        // Business-tier limits; this just makes it permanent (status=Active,
        // no trial_ends_at) rather than something that'll eventually expire.
        $workspace->subscription()->updateOrCreate([], [
            'plan' => SubscriptionPlan::Business,
            'status' => \App\Enums\SubscriptionStatus::Active,
            'trial_ends_at' => null,
        ]);
```

(Add `use App\Enums\SubscriptionStatus;` to the file's imports instead of the inline `\App\Enums\SubscriptionStatus::Active` if the file doesn't already import it -- check the top of the file first and use whichever form matches its existing import style.)

- [ ] **Step 2: Verify the seeder still runs cleanly**

Run: `cd backend && php artisan db:seed --class=WorkspaceSeeder`
Expected: no errors. (If run against a database that already has the demo workspace, this is idempotent via `updateOrCreate`.)

- [ ] **Step 3: Commit**

```bash
cd backend
git add database/seeders/WorkspaceSeeder.php
git commit -m "Make the demo workspace's Business plan permanent, not trial-based"
```

---

## Task 7: Access-gate middleware — lock out expired trials and canceled subscriptions

**Files:**
- Create: `backend/app/Http/Middleware/EnsureSubscriptionIsActive.php`
- Modify: `backend/bootstrap/app.php`
- Modify: `backend/routes/api.php`
- Test: `backend/tests/Feature/Billing/SubscriptionAccessTest.php` (new)
- Modify: `backend/tests/Feature/Billing/PlanLimitsTest.php` (rewrite trial-era assumptions)

**Interfaces:**
- Consumes: `Subscription::$status`, `Subscription::$trial_ends_at` (Task 3); every model's existing `workspace()` relation (`Epk`, `Media`, `Contact`, `Artist`, `WorkspaceMember`, `Workspace` itself).
- Produces: a `subscription-active` middleware alias, applied to workspace-scoped routes, exempting billing routes via `Route::withoutMiddleware()`.

- [ ] **Step 1: Write the failing test**

Create `backend/tests/Feature/Billing/SubscriptionAccessTest.php`:

```php
<?php

use App\Enums\SubscriptionStatus;
use App\Enums\WorkspaceRole;
use App\Models\Artist;
use App\Models\User;
use App\Models\Workspace;

function accessTestWorkspace(): array
{
    $owner = User::factory()->create();
    $workspace = Workspace::factory()->create(['created_by' => $owner->id]);
    $workspace->members()->create(['user_id' => $owner->id, 'role' => WorkspaceRole::Owner, 'status' => 'active', 'joined_at' => now()]);

    return [$workspace, $owner];
}

it('allows access while a trial is still running', function () {
    [$workspace, $owner] = accessTestWorkspace();

    $this->actingAs($owner)
        ->getJson("/api/workspaces/{$workspace->id}")
        ->assertOk();
});

it('blocks a workspace-scoped route once the trial has expired with no paid subscription', function () {
    [$workspace, $owner] = accessTestWorkspace();
    $workspace->subscription()->update(['trial_ends_at' => now()->subDay()]);

    $this->actingAs($owner)
        ->getJson("/api/workspaces/{$workspace->id}")
        ->assertStatus(402);
});

it('blocks an epk-scoped route via the epk\'s own workspace once locked out', function () {
    [$workspace, $owner] = accessTestWorkspace();
    $workspace->subscription()->update(['trial_ends_at' => now()->subDay()]);
    $artist = Artist::factory()->create(['workspace_id' => $workspace->id]);

    $this->actingAs($owner)
        ->postJson('/api/epks', ['workspace_id' => $workspace->id, 'artist_id' => $artist->id, 'title' => 'Nope'])
        ->assertStatus(402);
});

it('still allows access once a workspace has an active paid subscription, trial or not', function () {
    [$workspace, $owner] = accessTestWorkspace();
    $workspace->subscription()->update(['status' => SubscriptionStatus::Active, 'trial_ends_at' => now()->subDay()]);

    $this->actingAs($owner)
        ->getJson("/api/workspaces/{$workspace->id}")
        ->assertOk();
});

it('blocks a canceled subscription with no active trial', function () {
    [$workspace, $owner] = accessTestWorkspace();
    $workspace->subscription()->update(['status' => SubscriptionStatus::Canceled, 'trial_ends_at' => now()->subDay()]);

    $this->actingAs($owner)
        ->getJson("/api/workspaces/{$workspace->id}")
        ->assertStatus(402);
});

it('never blocks the billing routes themselves, even when locked out', function () {
    [$workspace, $owner] = accessTestWorkspace();
    $workspace->subscription()->update(['trial_ends_at' => now()->subDay()]);

    $this->actingAs($owner)
        ->getJson("/api/workspaces/{$workspace->id}/billing")
        ->assertOk();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && php artisan test --filter=SubscriptionAccessTest`
Expected: FAIL — every request currently succeeds regardless of trial state, since the middleware doesn't exist yet; the "blocks..." tests get 200 instead of 402.

- [ ] **Step 3: Write the middleware**

Create `backend/app/Http/Middleware/EnsureSubscriptionIsActive.php`:

```php
<?php

namespace App\Http\Middleware;

use App\Enums\SubscriptionStatus;
use App\Models\Workspace;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Hard lockout for a workspace whose 14-day trial has run out (or whose
 * paid subscription was canceled) with nothing active to replace it --
 * every workspace-scoped route is blocked except the billing routes
 * themselves (excluded via Route::withoutMiddleware() in routes/api.php),
 * so a locked-out workspace can still always reach the one place that lets
 * it pay to unlock again.
 *
 * Resolves "the workspace" generically from whatever's route-bound on this
 * request -- a Workspace directly, or any other model with its own
 * workspace() relation (Epk, Media, Contact, Artist, WorkspaceMember all
 * have one) -- rather than hardcoding a list of route parameter names, so
 * a new workspace-scoped route never needs this middleware taught about
 * its specific shape.
 */
class EnsureSubscriptionIsActive
{
    public function handle(Request $request, Closure $next): Response
    {
        $workspace = $this->resolveWorkspace($request);

        if ($workspace === null) {
            return $next($request);
        }

        $subscription = $workspace->subscription;

        $hasAccess = $subscription?->status === SubscriptionStatus::Active
            || ($subscription?->status === SubscriptionStatus::Trialing && $subscription->trial_ends_at?->isFuture());

        if (! $hasAccess) {
            abort(402, __('Your trial has ended. Choose a plan to keep using this workspace.'));
        }

        return $next($request);
    }

    private function resolveWorkspace(Request $request): ?Workspace
    {
        foreach ($request->route()?->parameters() ?? [] as $param) {
            if ($param instanceof Workspace) {
                return $param;
            }

            if (is_object($param) && method_exists($param, 'workspace')) {
                return $param->workspace;
            }
        }

        // Index/list-style routes (e.g. GET /epks?workspace_id=1) resolve
        // the workspace from a query param instead of a bound route model.
        if ($request->filled('workspace_id')) {
            return Workspace::find($request->input('workspace_id'));
        }

        return null;
    }
}
```

- [ ] **Step 4: Register the middleware alias**

In `backend/bootstrap/app.php`, add the import and register the alias alongside the existing ones:

```php
use App\Http\Middleware\EnsureSubscriptionIsActive;
```

```php
        $middleware->alias([
            'admin' => EnsureUserIsAdmin::class,
            'active' => EnsureAccountIsActive::class,
            'tokens-enabled' => RejectDisabledApiTokens::class,
            'subscription-active' => EnsureSubscriptionIsActive::class,
        ]);
```

- [ ] **Step 5: Wire it into the routes**

In `backend/routes/api.php`, add `'subscription-active'` to the main authenticated group's middleware array:

```php
Route::middleware(['auth:sanctum', 'active', 'tokens-enabled', 'subscription-active'])->group(function () {
```

Then, immediately after the three billing route definitions (`show`, `checkout`, `portal` -- the block starting `Route::get('/workspaces/{workspace}/billing', ...)`), mark them exempt. Replace:

```php
    Route::get('/workspaces/{workspace}/billing', [BillingController::class, 'show']);
    Route::post('/workspaces/{workspace}/billing/checkout', [BillingController::class, 'checkout'])
        ->middleware('throttle:10,1');
    Route::post('/workspaces/{workspace}/billing/portal', [BillingController::class, 'portal'])
        ->middleware('throttle:10,1');
```

with:

```php
    Route::withoutMiddleware('subscription-active')->group(function () {
        Route::get('/workspaces/{workspace}/billing', [BillingController::class, 'show']);
        Route::post('/workspaces/{workspace}/billing/checkout', [BillingController::class, 'checkout'])
            ->middleware('throttle:10,1');
        Route::post('/workspaces/{workspace}/billing/portal', [BillingController::class, 'portal'])
            ->middleware('throttle:10,1');
    });
```

(Keep whatever the exact existing throttle middleware chain looks like on those two POST routes -- only the outer wrapping changes.)

- [ ] **Step 6: Run the new test to verify it passes**

Run: `cd backend && php artisan test --filter=SubscriptionAccessTest`
Expected: PASS — all 6 tests green.

- [ ] **Step 7: Rewrite the now-outdated Feature/Billing/PlanLimitsTest.php**

This file's tests assert "free plan" behavior that's no longer reachable via a normal trial (a fresh workspace is on Business during its trial, not a limited tier) -- rewrite it to test the *paid-tier* limits directly (bypassing the trial by setting an Active subscription), which is what these tests were always really about. Replace the whole file:

```php
<?php

use App\Enums\SubscriptionPlan;
use App\Enums\SubscriptionStatus;
use App\Enums\WorkspaceRole;
use App\Models\Artist;
use App\Models\Epk;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

function billingWorkspaceWithOwner(SubscriptionPlan $plan = SubscriptionPlan::Starter): array
{
    $owner = User::factory()->create();
    $workspace = Workspace::factory()->create(['created_by' => $owner->id]);
    $workspace->subscription()->update(['plan' => $plan, 'status' => SubscriptionStatus::Active, 'trial_ends_at' => null]);
    $workspace->members()->create(['user_id' => $owner->id, 'role' => WorkspaceRole::Owner, 'status' => 'active', 'joined_at' => now()]);

    return [$workspace, $owner];
}

it('exposes starter limits and two Stripe price ids per plan from config', function () {
    expect(config('plans.starter.max_epks'))->toBe(3);
    expect(config('plans.starter.max_storage_bytes'))->toBe(150 * 1024 * 1024);
    expect(config('plans.pro.max_storage_bytes'))->toBe(2 * 1024 * 1024 * 1024);
    expect(config('plans.business.max_storage_bytes'))->toBe(20 * 1024 * 1024 * 1024);
    expect(config('plans.starter'))->toHaveKeys(['stripe_price_id_monthly', 'stripe_price_id_yearly']);
    expect(config('plans'))->not->toHaveKey('free');
});

it('blocks creating a fourth epk on the starter plan (limit is 3)', function () {
    [$workspace, $owner] = billingWorkspaceWithOwner(SubscriptionPlan::Starter);
    $artist = Artist::factory()->create(['workspace_id' => $workspace->id]);
    Epk::factory()->count(3)->create(['workspace_id' => $workspace->id, 'artist_id' => $artist->id]);

    $this->actingAs($owner)->postJson('/api/epks', [
        'workspace_id' => $workspace->id,
        'artist_id' => $artist->id,
        'title' => 'One EPK Too Many',
    ])->assertUnprocessable();
});

it('allows a fourth epk once the workspace is on Pro', function () {
    [$workspace, $owner] = billingWorkspaceWithOwner(SubscriptionPlan::Pro);
    $artist = Artist::factory()->create(['workspace_id' => $workspace->id]);
    Epk::factory()->count(3)->create(['workspace_id' => $workspace->id, 'artist_id' => $artist->id]);

    $this->actingAs($owner)->postJson('/api/epks', [
        'workspace_id' => $workspace->id,
        'artist_id' => $artist->id,
        'title' => 'Fourth EPK',
    ])->assertCreated();
});

it('blocks duplicating an epk on the starter plan, same as creating one directly', function () {
    [$workspace, $owner] = billingWorkspaceWithOwner(SubscriptionPlan::Starter);
    $artist = Artist::factory()->create(['workspace_id' => $workspace->id]);
    Epk::factory()->count(2)->create(['workspace_id' => $workspace->id, 'artist_id' => $artist->id]);
    $epk = Epk::factory()->create(['workspace_id' => $workspace->id, 'artist_id' => $artist->id]);

    $this->actingAs($owner)->postJson("/api/epks/{$epk->id}/duplicate")->assertUnprocessable();
    expect($workspace->epks()->count())->toBe(3);
});

it('blocks custom theme overrides on the starter plan but still allows picking a preset', function () {
    [$workspace, $owner] = billingWorkspaceWithOwner(SubscriptionPlan::Starter);
    $artist = Artist::factory()->create(['workspace_id' => $workspace->id]);
    $epk = Epk::factory()->create(['workspace_id' => $workspace->id, 'artist_id' => $artist->id]);

    $this->actingAs($owner)->putJson("/api/epks/{$epk->id}", ['theme' => 'dark'])
        ->assertOk()
        ->assertJsonPath('data.theme', 'dark');

    $this->actingAs($owner)->putJson("/api/epks/{$epk->id}", [
        'custom_settings' => ['accent_color' => '#ff0000'],
    ])->assertUnprocessable();
});

it('blocks creating a private link on the starter plan', function () {
    [$workspace, $owner] = billingWorkspaceWithOwner(SubscriptionPlan::Starter);
    $artist = Artist::factory()->create(['workspace_id' => $workspace->id]);
    $epk = Epk::factory()->create(['workspace_id' => $workspace->id, 'artist_id' => $artist->id]);

    $this->actingAs($owner)->postJson("/api/epks/{$epk->id}/private-links", ['label' => 'For the label'])
        ->assertUnprocessable();
});

it('blocks inviting past the starter plan team member limit', function () {
    [$workspace, $owner] = billingWorkspaceWithOwner(SubscriptionPlan::Starter);
    $second = User::factory()->create();
    $workspace->members()->create(['user_id' => $second->id, 'role' => WorkspaceRole::Editor, 'status' => 'active', 'joined_at' => now()]);

    // Starter's max_team_members is 2, and the workspace already has 2.
    $this->actingAs($owner)->postJson("/api/workspaces/{$workspace->id}/members", [
        'email' => 'third@example.com',
        'role' => WorkspaceRole::Viewer->value,
    ])->assertUnprocessable();
});

it('blocks a media upload that would exceed the plan storage limit', function () {
    Storage::fake('public');
    config(['plans.starter.max_storage_bytes' => 1024]); // 1KB, smaller than any real fake image
    [$workspace, $owner] = billingWorkspaceWithOwner(SubscriptionPlan::Starter);

    $this->actingAs($owner)->postJson("/api/workspaces/{$workspace->id}/media", [
        'files' => [UploadedFile::fake()->image('cover.jpg', 200, 200)],
    ])->assertUnprocessable();
});

it('lets an admin change a workspace plan, unlocking that workspace\'s limits', function () {
    $admin = User::factory()->admin()->create();
    [$workspace] = billingWorkspaceWithOwner(SubscriptionPlan::Starter);

    $this->actingAs($admin)->patchJson("/api/admin/workspaces/{$workspace->id}/subscription", [
        'plan' => SubscriptionPlan::Business->value,
    ])->assertOk()->assertJsonPath('data.plan', SubscriptionPlan::Business->value);

    expect($workspace->subscription->fresh()->plan)->toBe(SubscriptionPlan::Business);
    $this->assertDatabaseHas('audit_logs', ['action' => 'workspace.plan_changed_by_admin', 'subject_id' => $workspace->id]);
});

it('returns plan, usage, and the plan comparison table from the billing endpoint', function () {
    [$workspace, $owner] = billingWorkspaceWithOwner(SubscriptionPlan::Starter);

    $response = $this->actingAs($owner)->getJson("/api/workspaces/{$workspace->id}/billing");

    $response->assertOk()
        ->assertJsonPath('data.plan', SubscriptionPlan::Starter->value)
        ->assertJsonPath('data.usage.epks.limit', 3)
        ->assertJsonStructure(['data' => ['plan', 'usage', 'plans' => ['starter', 'pro', 'business']]]);
});
```

- [ ] **Step 8: Run the full billing test directory to verify everything passes together**

Run: `cd backend && php artisan test tests/Feature/Billing tests/Feature/Database/SeederTest.php`
Expected: PASS — all tests across `SubscriptionAccessTest`, the rewritten `PlanLimitsTest`, and `SeederTest` green. (`StripeWebhookTest` and `BillingCheckoutTest` are fixed in Task 8/9 -- they'll still fail at this point, which is expected.)

- [ ] **Step 9: Commit**

```bash
cd backend
git add app/Http/Middleware/EnsureSubscriptionIsActive.php bootstrap/app.php routes/api.php tests/Feature/Billing/SubscriptionAccessTest.php tests/Feature/Billing/PlanLimitsTest.php
git commit -m "Add hard-lockout middleware for expired trials / canceled subscriptions"
```

---

## Task 8: Stripe integration — monthly/yearly price selection and reverse lookup

**Files:**
- Modify: `backend/app/Services/StripeBillingService.php`
- Test: `backend/tests/Feature/Billing/StripeWebhookTest.php` (rewrite)

**Interfaces:**
- Consumes: `config('plans.{plan}.stripe_price_id_monthly'/'stripe_price_id_yearly')` (Task 4)
- Produces: `StripeBillingService::createCheckoutSession(Workspace $workspace, SubscriptionPlan $plan, string $interval, string $successUrl, string $cancelUrl): string` (new `$interval` parameter) -- consumed by Task 10 (BillingController).

- [ ] **Step 1: Write the failing test**

Replace `backend/tests/Feature/Billing/StripeWebhookTest.php`:

```php
<?php

use App\Enums\SubscriptionPlan;
use App\Enums\SubscriptionStatus;
use App\Models\Workspace;
use Stripe\WebhookSignature;

function stripeSubscriptionPayload(array $overrides = []): string
{
    $subscription = array_replace([
        'id' => 'sub_test_123',
        'object' => 'subscription',
        'customer' => 'cus_test_123',
        'status' => 'active',
        'canceled_at' => null,
        'metadata' => ['workspace_id' => '1'],
        'items' => [
            'object' => 'list',
            'data' => [
                [
                    'id' => 'si_test_123',
                    'object' => 'subscription_item',
                    'current_period_end' => 1_800_000_000,
                    'price' => ['id' => 'price_test_pro_monthly', 'object' => 'price'],
                ],
            ],
        ],
    ], $overrides);

    return json_encode([
        'id' => 'evt_test_'.uniqid(),
        'object' => 'event',
        'type' => $overrides['_event_type'] ?? 'customer.subscription.updated',
        'data' => ['object' => $subscription],
    ]);
}

function signedStripeHeaders(string $payload): array
{
    return ['Stripe-Signature' => WebhookSignature::generateSignatureHeader($payload, config('services.stripe.webhook_secret'))];
}

it('rejects a webhook with an invalid signature', function () {
    $payload = stripeSubscriptionPayload();

    $this->postJson('/api/stripe/webhook', json_decode($payload, true), ['Stripe-Signature' => 't=1,v1=not-a-real-signature'])
        ->assertStatus(400);
});

it('syncs plan, interval, status, and period end from a subscription.updated event (monthly price)', function () {
    $workspace = Workspace::factory()->create();

    $payload = stripeSubscriptionPayload(['metadata' => ['workspace_id' => (string) $workspace->id]]);

    $this->call('POST', '/api/stripe/webhook', [], [], [], [
        'HTTP_Stripe-Signature' => signedStripeHeaders($payload)['Stripe-Signature'],
        'CONTENT_TYPE' => 'application/json',
    ], $payload)->assertOk();

    $subscription = $workspace->subscription()->first();
    expect($subscription->plan)->toBe(SubscriptionPlan::Pro)
        ->and($subscription->billing_interval)->toBe('monthly')
        ->and($subscription->status)->toBe(SubscriptionStatus::Active)
        ->and($subscription->stripe_customer_id)->toBe('cus_test_123')
        ->and($subscription->stripe_subscription_id)->toBe('sub_test_123')
        ->and($subscription->current_period_ends_at)->not->toBeNull();
});

it('resolves the yearly price id to the same plan with a yearly interval', function () {
    $workspace = Workspace::factory()->create();

    $payload = stripeSubscriptionPayload([
        'metadata' => ['workspace_id' => (string) $workspace->id],
        'items' => [
            'object' => 'list',
            'data' => [[
                'id' => 'si_test_123',
                'object' => 'subscription_item',
                'current_period_end' => 1_800_000_000,
                'price' => ['id' => 'price_test_pro_yearly', 'object' => 'price'],
            ]],
        ],
    ]);

    $this->call('POST', '/api/stripe/webhook', [], [], [], [
        'HTTP_Stripe-Signature' => signedStripeHeaders($payload)['Stripe-Signature'],
        'CONTENT_TYPE' => 'application/json',
    ], $payload)->assertOk();

    $subscription = $workspace->subscription()->first();
    expect($subscription->plan)->toBe(SubscriptionPlan::Pro)
        ->and($subscription->billing_interval)->toBe('yearly');
});

it('marks a subscription past_due from a payment failure status', function () {
    $workspace = Workspace::factory()->create();
    $workspace->subscription()->update(['plan' => SubscriptionPlan::Pro]);

    $payload = stripeSubscriptionPayload([
        'status' => 'past_due',
        'metadata' => ['workspace_id' => (string) $workspace->id],
    ]);

    $this->call('POST', '/api/stripe/webhook', [], [], [], [
        'HTTP_Stripe-Signature' => signedStripeHeaders($payload)['Stripe-Signature'],
        'CONTENT_TYPE' => 'application/json',
    ], $payload)->assertOk();

    expect($workspace->subscription()->first()->status)->toBe(SubscriptionStatus::PastDue);
});

it('marks the subscription canceled (not reverted to any plan) when deleted on Stripe\'s side', function () {
    $workspace = Workspace::factory()->create();
    $workspace->subscription()->update([
        'plan' => SubscriptionPlan::Business,
        'status' => SubscriptionStatus::Active,
        'stripe_subscription_id' => 'sub_test_123',
    ]);

    $payload = stripeSubscriptionPayload([
        '_event_type' => 'customer.subscription.deleted',
        'metadata' => ['workspace_id' => (string) $workspace->id],
    ]);

    $this->call('POST', '/api/stripe/webhook', [], [], [], [
        'HTTP_Stripe-Signature' => signedStripeHeaders($payload)['Stripe-Signature'],
        'CONTENT_TYPE' => 'application/json',
    ], $payload)->assertOk();

    $subscription = $workspace->subscription()->first();
    // Plan is left as whatever it last was (Business here) -- irrelevant
    // once canceled, since the access-gate middleware blocks on status,
    // not plan. No more "revert to Free": there's nothing to revert to.
    expect($subscription->plan)->toBe(SubscriptionPlan::Business)
        ->and($subscription->status)->toBe(SubscriptionStatus::Canceled)
        ->and($subscription->stripe_subscription_id)->toBeNull()
        ->and($subscription->canceled_at)->not->toBeNull();
});

it('ignores an event for a workspace that no longer exists without erroring', function () {
    $payload = stripeSubscriptionPayload(['metadata' => ['workspace_id' => '999999']]);

    $this->call('POST', '/api/stripe/webhook', [], [], [], [
        'HTTP_Stripe-Signature' => signedStripeHeaders($payload)['Stripe-Signature'],
        'CONTENT_TYPE' => 'application/json',
    ], $payload)->assertOk();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && php artisan test --filter=StripeWebhookTest`
Expected: FAIL — `billing_interval` stays null (nothing sets it yet), and the "deleted" test fails since the current code still reverts to a `Free` plan that no longer exists.

- [ ] **Step 3: Rewrite StripeBillingService**

Replace `backend/app/Services/StripeBillingService.php`:

```php
<?php

namespace App\Services;

use App\Enums\SubscriptionPlan;
use App\Enums\SubscriptionStatus;
use App\Models\Subscription;
use App\Models\Workspace;
use RuntimeException;
use Stripe\Event;
use Stripe\Exception\SignatureVerificationException;
use Stripe\StripeClient;
use Stripe\Subscription as StripeSubscription;
use Stripe\Webhook;

/**
 * Thin wrapper around the raw Stripe SDK rather than Laravel Cashier --
 * Cashier's Billable trait and its own `subscriptions` table assume a
 * single billable model (usually User) with Cashier's own schema, which
 * would collide with the workspace-scoped `subscriptions` table and
 * SubscriptionPlan/SubscriptionStatus enums this app already had in place
 * before Stripe was wired up (see config/plans.php). This keeps that
 * existing shape as the source of truth and only talks to Stripe for the
 * checkout/portal/webhook mechanics.
 */
class StripeBillingService
{
    private StripeClient $client;

    public function __construct()
    {
        $this->client = new StripeClient(config('services.stripe.secret'));
    }

    /**
     * @return string The Stripe-hosted Checkout URL to redirect the browser to.
     */
    public function createCheckoutSession(Workspace $workspace, SubscriptionPlan $plan, string $interval, string $successUrl, string $cancelUrl): string
    {
        $priceId = config("plans.{$plan->value}.stripe_price_id_{$interval}");

        if (! $priceId) {
            throw new RuntimeException("No Stripe {$interval} price is configured for the \"{$plan->value}\" plan.");
        }

        $existingCustomerId = $workspace->subscription?->stripe_customer_id;

        $session = $this->client->checkout->sessions->create([
            'mode' => 'subscription',
            'customer' => $existingCustomerId,
            'customer_email' => $existingCustomerId ? null : $workspace->creator?->email,
            // Belt-and-suspenders workspace lookup on the webhook side: this
            // lands on the Checkout Session itself, while subscription_data
            // below copies the same metadata onto the Subscription object
            // Stripe creates -- every later `customer.subscription.*` event
            // carries it too, not just the initial checkout.session.completed.
            'client_reference_id' => (string) $workspace->id,
            'line_items' => [['price' => $priceId, 'quantity' => 1]],
            'success_url' => $successUrl,
            'cancel_url' => $cancelUrl,
            'subscription_data' => [
                'metadata' => ['workspace_id' => $workspace->id],
            ],
        ]);

        return $session->url;
    }

    /**
     * @return string The Stripe-hosted Billing Portal URL -- lets the
     *                workspace owner change plans, update their card, or cancel
     *                entirely without any of that needing its own UI in this app.
     */
    public function createPortalSession(Workspace $workspace, string $returnUrl): string
    {
        $customerId = $workspace->subscription?->stripe_customer_id;

        if (! $customerId) {
            throw new RuntimeException('This workspace has no billing account yet — subscribe to a paid plan first.');
        }

        $session = $this->client->billingPortal->sessions->create([
            'customer' => $customerId,
            'return_url' => $returnUrl,
        ]);

        return $session->url;
    }

    /**
     * Verifies the request actually came from Stripe (not a forged POST to
     * a guessed public URL) before any event data is trusted.
     *
     * @throws SignatureVerificationException
     */
    public function constructEvent(string $payload, string $signature): Event
    {
        return Webhook::constructEvent($payload, $signature, (string) config('services.stripe.webhook_secret'));
    }

    public function syncFromStripeSubscription(StripeSubscription $stripeSubscription): void
    {
        $workspaceId = $stripeSubscription->metadata['workspace_id'] ?? null;

        if (! $workspaceId || ! Workspace::whereKey($workspaceId)->exists()) {
            return;
        }

        $firstItem = $stripeSubscription->items->data[0] ?? null;
        $priceId = $firstItem?->price->id ?? null;
        // Stripe API 2025-03-31+ moved current_period_end off the
        // subscription root onto each line item (a subscription can mix
        // items with different billing cycles) -- this SDK is pinned to
        // 2026-08-26.dahlia, well past that change.
        $periodEnd = $firstItem?->current_period_end ?? null;

        [$plan, $interval] = $this->planAndIntervalFromPriceId($priceId);

        Subscription::updateOrCreate(
            ['workspace_id' => $workspaceId],
            [
                'plan' => $plan,
                'billing_interval' => $interval,
                'status' => $this->mapStatus($stripeSubscription->status),
                'stripe_customer_id' => is_string($stripeSubscription->customer)
                    ? $stripeSubscription->customer
                    : $stripeSubscription->customer->id,
                'stripe_subscription_id' => $stripeSubscription->id,
                'current_period_ends_at' => $periodEnd !== null
                    ? now()->createFromTimestamp($periodEnd)
                    : null,
                'canceled_at' => $stripeSubscription->canceled_at !== null
                    ? now()->createFromTimestamp($stripeSubscription->canceled_at)
                    : null,
            ]
        );
    }

    /**
     * The subscription no longer exists on Stripe's side at all (as
     * opposed to merely being past-due). There's no Free plan to fall back
     * to any more -- this just marks the subscription canceled, which the
     * access-gate middleware (EnsureSubscriptionIsActive) reads as a hard
     * lockout, same as an expired trial. `plan` is deliberately left
     * untouched: it no longer means anything once status is Canceled.
     */
    public function handleSubscriptionDeleted(StripeSubscription $stripeSubscription): void
    {
        $workspaceId = $stripeSubscription->metadata['workspace_id'] ?? null;

        if (! $workspaceId) {
            return;
        }

        Subscription::where('workspace_id', $workspaceId)->update([
            'status' => SubscriptionStatus::Canceled,
            'stripe_subscription_id' => null,
            'canceled_at' => now(),
        ]);
    }

    /**
     * @return array{0: SubscriptionPlan, 1: string|null}
     */
    private function planAndIntervalFromPriceId(?string $priceId): array
    {
        if ($priceId !== null) {
            foreach (SubscriptionPlan::cases() as $plan) {
                foreach (['monthly', 'yearly'] as $interval) {
                    if (config("plans.{$plan->value}.stripe_price_id_{$interval}") === $priceId) {
                        return [$plan, $interval];
                    }
                }
            }
        }

        return [SubscriptionPlan::Starter, null];
    }

    private function mapStatus(string $stripeStatus): SubscriptionStatus
    {
        return match ($stripeStatus) {
            'active', 'trialing' => SubscriptionStatus::Active,
            'past_due', 'unpaid', 'incomplete' => SubscriptionStatus::PastDue,
            'canceled', 'incomplete_expired' => SubscriptionStatus::Canceled,
            default => SubscriptionStatus::Active,
        };
    }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd backend && php artisan test --filter=StripeWebhookTest`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd backend
git add app/Services/StripeBillingService.php tests/Feature/Billing/StripeWebhookTest.php
git commit -m "Resolve plan + billing interval together from Stripe price ids"
```

---

## Task 9: BillingController — accept interval, expose trial info

**Files:**
- Modify: `backend/app/Http/Controllers/Api/BillingController.php`
- Modify: `backend/tests/Feature/Billing/BillingCheckoutTest.php` (rewrite)

**Interfaces:**
- Consumes: `StripeBillingService::createCheckoutSession(..., string $interval, ...)` (Task 8)
- Produces: `POST /workspaces/{workspace}/billing/checkout` now requires `interval` in the request body; `GET /workspaces/{workspace}/billing` response gains `trial_ends_at` -- consumed by Task 12 (frontend api/billing.ts, types).

- [ ] **Step 1: Write the failing test**

Replace `backend/tests/Feature/Billing/BillingCheckoutTest.php`:

```php
<?php

use App\Enums\SubscriptionPlan;
use App\Enums\WorkspaceRole;
use App\Models\User;
use App\Models\Workspace;
use App\Services\StripeBillingService;

function makeWorkspaceWithRoleForBilling(WorkspaceRole $role): array
{
    $owner = User::factory()->create();
    $workspace = Workspace::factory()->create(['created_by' => $owner->id]);
    $workspace->members()->create(['user_id' => $owner->id, 'role' => WorkspaceRole::Owner, 'status' => 'active', 'joined_at' => now()]);

    if ($role === WorkspaceRole::Owner) {
        return [$workspace, $owner];
    }

    $member = User::factory()->create();
    $workspace->members()->create(['user_id' => $member->id, 'role' => $role, 'status' => 'active', 'joined_at' => now()]);

    return [$workspace, $member];
}

it('creates a Stripe Checkout session for a valid plan and interval', function () {
    [$workspace, $owner] = makeWorkspaceWithRoleForBilling(WorkspaceRole::Owner);

    $this->mock(StripeBillingService::class, function ($mock) {
        $mock->shouldReceive('createCheckoutSession')
            ->once()
            ->withArgs(fn ($ws, $plan, $interval) => $plan === SubscriptionPlan::Pro && $interval === 'yearly')
            ->andReturn('https://checkout.stripe.com/c/pay/fake_session');
    });

    $this->actingAs($owner)
        ->postJson("/api/workspaces/{$workspace->id}/billing/checkout", ['plan' => 'pro', 'interval' => 'yearly'])
        ->assertOk()
        ->assertJsonPath('data.url', 'https://checkout.stripe.com/c/pay/fake_session');
});

it('rejects an unknown plan for checkout', function () {
    [$workspace, $owner] = makeWorkspaceWithRoleForBilling(WorkspaceRole::Owner);

    $this->actingAs($owner)
        ->postJson("/api/workspaces/{$workspace->id}/billing/checkout", ['plan' => 'not-a-real-plan', 'interval' => 'monthly'])
        ->assertUnprocessable();
});

it('rejects an unknown billing interval for checkout', function () {
    [$workspace, $owner] = makeWorkspaceWithRoleForBilling(WorkspaceRole::Owner);

    $this->actingAs($owner)
        ->postJson("/api/workspaces/{$workspace->id}/billing/checkout", ['plan' => 'pro', 'interval' => 'weekly'])
        ->assertUnprocessable();
});

it('refuses checkout for a viewer (admin-level ability required)', function () {
    [$workspace, $viewer] = makeWorkspaceWithRoleForBilling(WorkspaceRole::Viewer);

    $this->actingAs($viewer)
        ->postJson("/api/workspaces/{$workspace->id}/billing/checkout", ['plan' => 'pro', 'interval' => 'monthly'])
        ->assertForbidden();
});

it('creates a Stripe Billing Portal session', function () {
    [$workspace, $owner] = makeWorkspaceWithRoleForBilling(WorkspaceRole::Owner);

    $this->mock(StripeBillingService::class, function ($mock) {
        $mock->shouldReceive('createPortalSession')
            ->once()
            ->andReturn('https://billing.stripe.com/p/session/fake');
    });

    $this->actingAs($owner)
        ->postJson("/api/workspaces/{$workspace->id}/billing/portal")
        ->assertOk()
        ->assertJsonPath('data.url', 'https://billing.stripe.com/p/session/fake');
});

it('surfaces a friendly error when the portal is requested with no Stripe customer yet', function () {
    [$workspace, $owner] = makeWorkspaceWithRoleForBilling(WorkspaceRole::Owner);

    $this->mock(StripeBillingService::class, function ($mock) {
        $mock->shouldReceive('createPortalSession')
            ->once()
            ->andThrow(new RuntimeException('This workspace has no billing account yet — subscribe to a paid plan first.'));
    });

    $this->actingAs($owner)
        ->postJson("/api/workspaces/{$workspace->id}/billing/portal")
        ->assertUnprocessable()
        ->assertJsonPath('errors.workspace.0', 'This workspace has no billing account yet — subscribe to a paid plan first.');
});

it('includes trial_ends_at in the billing show response', function () {
    [$workspace, $owner] = makeWorkspaceWithRoleForBilling(WorkspaceRole::Owner);

    $this->actingAs($owner)
        ->getJson("/api/workspaces/{$workspace->id}/billing")
        ->assertOk()
        ->assertJsonPath('data.trial_ends_at', fn ($value) => $value !== null);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && php artisan test --filter=BillingCheckoutTest`
Expected: FAIL — `interval` isn't validated/passed yet, and `trial_ends_at` isn't in the response.

- [ ] **Step 3: Update BillingController**

Replace `backend/app/Http/Controllers/Api/BillingController.php`:

```php
<?php

namespace App\Http\Controllers\Api;

use App\Enums\SubscriptionPlan;
use App\Http\Controllers\Controller;
use App\Models\Workspace;
use App\Services\PlanLimits;
use App\Services\StripeBillingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use RuntimeException;

class BillingController extends Controller
{
    public function show(Workspace $workspace, PlanLimits $planLimits): JsonResponse
    {
        $this->authorize('view', $workspace);

        return response()->json([
            'data' => [
                'plan' => $planLimits->plan($workspace),
                'subscription_status' => $workspace->subscription?->status,
                'trial_ends_at' => $workspace->subscription?->trial_ends_at,
                'billing_interval' => $workspace->subscription?->billing_interval,
                'current_period_ends_at' => $workspace->subscription?->current_period_ends_at,
                'has_stripe_customer' => $workspace->subscription?->stripe_customer_id !== null,
                'usage' => [
                    'epks' => ['used' => $workspace->epks()->count(), 'limit' => $planLimits->maxEpks($workspace)],
                    'team_members' => ['used' => $workspace->members()->count(), 'limit' => $planLimits->maxTeamMembers($workspace)],
                    'storage_bytes' => [
                        'used' => (int) $workspace->media()->sum('size'),
                        'limit' => $planLimits->maxStorageBytes($workspace),
                    ],
                ],
                'plans' => collect(SubscriptionPlan::cases())->mapWithKeys(
                    fn (SubscriptionPlan $plan) => [$plan->value => ['plan' => $plan, ...config("plans.{$plan->value}")]]
                ),
            ],
        ]);
    }

    /**
     * Starts a Stripe Checkout session to subscribe (or switch) this
     * workspace to a paid plan, at the requested billing interval.
     * Admin-level only — same ability as any other workspace-settings
     * change, matching WorkspacePolicy::update.
     */
    public function checkout(Request $request, Workspace $workspace, StripeBillingService $stripe): JsonResponse
    {
        $this->authorize('update', $workspace);

        $validated = $request->validate([
            'plan' => ['required', Rule::in([
                SubscriptionPlan::Starter->value,
                SubscriptionPlan::Pro->value,
                SubscriptionPlan::Business->value,
            ])],
            'interval' => ['required', Rule::in(['monthly', 'yearly'])],
        ]);

        $frontendUrl = rtrim((string) config('app.frontend_url'), '/');

        try {
            $url = $stripe->createCheckoutSession(
                $workspace,
                SubscriptionPlan::from($validated['plan']),
                $validated['interval'],
                successUrl: "{$frontendUrl}/billing?checkout=success",
                cancelUrl: "{$frontendUrl}/billing?checkout=canceled",
            );
        } catch (RuntimeException $e) {
            throw ValidationException::withMessages(['plan' => $e->getMessage()]);
        }

        return response()->json(['data' => ['url' => $url]]);
    }

    /**
     * Opens Stripe's own hosted Billing Portal — card updates, invoice
     * history, cancellation, and plan switching all happen there instead
     * of this app needing to build any of it.
     */
    public function portal(Workspace $workspace, StripeBillingService $stripe): JsonResponse
    {
        $this->authorize('update', $workspace);

        $frontendUrl = rtrim((string) config('app.frontend_url'), '/');

        try {
            $url = $stripe->createPortalSession($workspace, returnUrl: "{$frontendUrl}/billing");
        } catch (RuntimeException $e) {
            throw ValidationException::withMessages(['workspace' => $e->getMessage()]);
        }

        return response()->json(['data' => ['url' => $url]]);
    }
}
```

(Note: `checkout()` now also accepts `Starter` as a checkout target, not just `Pro`/`Business` — a trialing workspace choosing to pay for the entry tier needs to be able to check out into it too.)

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd backend && php artisan test --filter=BillingCheckoutTest`
Expected: PASS

- [ ] **Step 5: Run the entire backend suite to confirm nothing else regressed**

Run: `cd backend && php artisan test`
Expected: PASS, all tests green. If anything outside `tests/Feature/Billing` or `tests/Feature/Database/SeederTest.php` fails, it's almost certainly another test creating a `Workspace::factory()->create()` and asserting old Free-plan-shaped behavior inline — track it down and fix its assertions to match Starter/trial semantics before moving on, since Task 10 onward assumes a fully green backend suite.

- [ ] **Step 6: Commit**

```bash
cd backend
git add app/Http/Controllers/Api/BillingController.php tests/Feature/Billing/BillingCheckoutTest.php
git commit -m "BillingController: require billing interval, expose trial_ends_at"
```

---

## Task 10: Frontend types and API client

**Files:**
- Modify: `frontend/src/types/index.ts`
- Modify: `frontend/src/api/billing.ts`
- Modify: `frontend/src/features/billing/hooks/useBilling.ts`

**Interfaces:**
- Consumes: `GET /workspaces/{id}/billing` response shape (Task 9): `plan`, `subscription_status`, `trial_ends_at`, `billing_interval`, `current_period_ends_at`, `has_stripe_customer`, `usage`, `plans` keyed by `starter|pro|business`.
- Produces: `SubscriptionPlan = 'starter'|'pro'|'business'`, `BillingData.trial_ends_at: string | null`, `createCheckoutSession(workspaceId, plan, interval)` -- consumed by Task 11 (BillingPage).

- [ ] **Step 1: Update types**

In `frontend/src/types/index.ts`, find and replace:

```typescript
export type SubscriptionPlan = 'free' | 'pro' | 'business'
```

with:

```typescript
export type SubscriptionPlan = 'starter' | 'pro' | 'business'
```

Find the `PlanDetails` interface (around line 737) and update it to match `BillingController::show()`'s response shape from Task 9 (Step 3) — each plan entry now embeds its own `plan` key, plus the two Stripe price ids pass through even though the frontend never reads them:

```typescript
export interface PlanDetails {
  plan: SubscriptionPlan
  label: string
  max_epks: number | null
  max_storage_bytes: number | null
  max_team_members: number | null
  custom_themes: boolean
  private_links: boolean
  white_label: boolean
  custom_domains: boolean
  stripe_price_id_monthly: string | null
  stripe_price_id_yearly: string | null
}
```

Find the `BillingData` interface (around line 756) and add the two new fields:

```typescript
export interface BillingData {
  plan: SubscriptionPlan
  subscription_status: SubscriptionStatus | null
  trial_ends_at: string | null
  billing_interval: 'monthly' | 'yearly' | null
  current_period_ends_at: string | null
  has_stripe_customer: boolean
  usage: {
    epks: { used: number; limit: number | null }
    team_members: { used: number; limit: number | null }
    storage_bytes: { used: number; limit: number | null }
  }
  plans: Record<SubscriptionPlan, PlanDetails>
}
```

(Adjust to match whichever fields the current interface already has beyond what's shown here — only add `trial_ends_at` and `billing_interval`, don't remove anything else already present. Check the file directly before editing, since the exact current shape of `usage`/other fields wasn't fully re-verified in this plan.)

- [ ] **Step 2: Update api/billing.ts**

Replace `frontend/src/api/billing.ts`:

```typescript
import { apiClient } from '@/api/client'
import type { ApiResource, BillingData, SubscriptionPlan } from '@/types'

export async function getBilling(workspaceId: number): Promise<BillingData> {
  const { data } = await apiClient.get<ApiResource<BillingData>>(`/api/workspaces/${workspaceId}/billing`)
  return data.data
}

export type BillingInterval = 'monthly' | 'yearly'

export async function createCheckoutSession(
  workspaceId: number,
  plan: SubscriptionPlan,
  interval: BillingInterval
): Promise<string> {
  const { data } = await apiClient.post<ApiResource<{ url: string }>>(
    `/api/workspaces/${workspaceId}/billing/checkout`,
    { plan, interval }
  )
  return data.data.url
}

export async function createPortalSession(workspaceId: number): Promise<string> {
  const { data } = await apiClient.post<ApiResource<{ url: string }>>(
    `/api/workspaces/${workspaceId}/billing/portal`
  )
  return data.data.url
}
```

- [ ] **Step 3: Update useBilling.ts**

Replace `frontend/src/features/billing/hooks/useBilling.ts`:

```typescript
import { useMutation, useQuery } from '@tanstack/react-query'
import { createCheckoutSession, createPortalSession, getBilling, type BillingInterval } from '@/api/billing'
import type { SubscriptionPlan } from '@/types'

export function useBilling(workspaceId: number | undefined) {
  return useQuery({
    queryKey: ['workspaces', workspaceId, 'billing'],
    queryFn: () => getBilling(workspaceId as number),
    enabled: workspaceId !== undefined,
  })
}

// No onSuccess cache update: both redirect the whole browser away to
// Stripe's own hosted page immediately, so there's nothing here to
// invalidate — the workspace's plan only actually changes once the user
// completes checkout and Stripe's webhook lands (see StripeWebhookController
// on the backend), well after this request/response is long gone. The
// Billing page's own useBilling() query naturally reflects that once the
// user is redirected back and it refetches.
export function useCreateCheckoutSession(workspaceId: number) {
  return useMutation({
    mutationFn: ({ plan, interval }: { plan: SubscriptionPlan; interval: BillingInterval }) =>
      createCheckoutSession(workspaceId, plan, interval),
  })
}

export function useCreatePortalSession(workspaceId: number) {
  return useMutation({
    mutationFn: () => createPortalSession(workspaceId),
  })
}
```

- [ ] **Step 4: Type-check**

Run: `cd frontend && npx tsc -b`
Expected: errors in `BillingPage.tsx` and its test (still referencing the old `'free'` plan value and the old single-argument checkout mutation) -- expected at this point, fixed in Task 11. No errors should appear in `types/index.ts`, `api/billing.ts`, or `useBilling.ts` themselves.

- [ ] **Step 5: Commit**

```bash
cd frontend
git add src/types/index.ts src/api/billing.ts src/features/billing/hooks/useBilling.ts
git commit -m "Frontend: Starter plan type, billing interval in checkout API"
```

---

## Task 11: BillingPage redesign — monthly/yearly toggle, trial banner, lockout

**Files:**
- Modify: `frontend/src/features/billing/pages/BillingPage.tsx`
- Modify: `frontend/src/features/billing/pages/BillingPage.test.tsx`
- Create: `frontend/src/lib/planPricing.ts`

**Interfaces:**
- Consumes: `BillingData` (Task 10), `useCreateCheckoutSession` mutation now taking `{plan, interval}` (Task 10)
- Produces: `PLAN_PRICING` lookup table consumed only within this task; the redesigned `BillingPage` component.

- [ ] **Step 1: Write the failing test**

Replace `frontend/src/features/billing/pages/BillingPage.test.tsx` (adjust imports/setup to match whatever test-rendering helper the current file already uses -- check it first; the shape below assumes the same `renderWithProviders`-style pattern already established elsewhere in this codebase's tests):

```typescript
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { BillingPage } from '@/features/billing/pages/BillingPage'
import { server } from '@/test/server'

const API_URL = 'http://localhost:8000'

function billingResponse(overrides: Record<string, unknown> = {}) {
  return {
    data: {
      plan: 'starter',
      subscription_status: 'trialing',
      trial_ends_at: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
      billing_interval: null,
      current_period_ends_at: null,
      has_stripe_customer: false,
      usage: {
        epks: { used: 0, limit: 3 },
        team_members: { used: 1, limit: 2 },
        storage_bytes: { used: 0, limit: 150 * 1024 * 1024 },
      },
      plans: {
        starter: { plan: 'starter', label: 'Starter', max_epks: 3, max_storage_bytes: 150 * 1024 * 1024, max_team_members: 2, custom_themes: false, private_links: false, white_label: false, custom_domains: false },
        pro: { plan: 'pro', label: 'Pro', max_epks: 10, max_storage_bytes: 2 * 1024 * 1024 * 1024, max_team_members: 10, custom_themes: true, private_links: true, white_label: false, custom_domains: false },
        business: { plan: 'business', label: 'Business', max_epks: null, max_storage_bytes: 20 * 1024 * 1024 * 1024, max_team_members: null, custom_themes: true, private_links: true, white_label: true, custom_domains: true },
      },
      ...overrides,
    },
  }
}

function renderBillingPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/billing']}>
        <BillingPage />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('BillingPage', () => {
  it('shows a trial countdown banner while trialing', async () => {
    server.use(http.get(`${API_URL}/api/workspaces/:id/billing`, () => HttpResponse.json(billingResponse())))

    renderBillingPage()

    expect(await screen.findByText(/5 days left/i)).toBeInTheDocument()
  })

  it('shows all three plan prices in monthly mode by default, and switches to yearly on toggle', async () => {
    server.use(http.get(`${API_URL}/api/workspaces/:id/billing`, () => HttpResponse.json(billingResponse())))

    renderBillingPage()

    expect(await screen.findByText('€6.66')).toBeInTheDocument()
    expect(screen.getByText('€26.66')).toBeInTheDocument()
    expect(screen.getByText('€99.99')).toBeInTheDocument()

    const user = userEvent.setup()
    await user.click(screen.getByRole('switch', { name: /yearly/i }))

    expect(await screen.findByText('€5.55')).toBeInTheDocument()
    expect(screen.getByText('€22.22')).toBeInTheDocument()
    expect(screen.getByText('€83.33')).toBeInTheDocument()
  })

  it('sends the selected interval when starting checkout', async () => {
    server.use(
      http.get(`${API_URL}/api/workspaces/:id/billing`, () => HttpResponse.json(billingResponse())),
      http.post(`${API_URL}/api/workspaces/:id/billing/checkout`, async ({ request }) => {
        const body = (await request.json()) as { plan: string; interval: string }
        expect(body).toEqual({ plan: 'pro', interval: 'monthly' })
        return HttpResponse.json({ data: { url: 'https://checkout.stripe.com/fake' } })
      })
    )

    renderBillingPage()

    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: /upgrade to pro/i }))

    await waitFor(() => expect(window.location.href).toContain('checkout.stripe.com'))
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npx vitest run src/features/billing/pages/BillingPage.test.tsx`
Expected: FAIL — the current page has no toggle, no trial banner, and its checkout mutation call shape doesn't match `{plan, interval}`.

- [ ] **Step 3: Write the pricing lookup table**

Create `frontend/src/lib/planPricing.ts`:

```typescript
import type { SubscriptionPlan } from '@/types'

/**
 * Static display prices (EUR) — not read from the backend, since the
 * backend only ever needs Stripe price ids, not the human-facing numbers.
 * Keep these in sync with backend/config/plans.php's comment block and
 * docs/superpowers/specs/2026-09-02-subscription-billing-overhaul-design.md
 * if either ever changes.
 */
export const PLAN_PRICING: Record<Exclude<SubscriptionPlan, never>, { monthly: number; yearlyEffectiveMonthly: number }> = {
  starter: { monthly: 6.66, yearlyEffectiveMonthly: 5.55 },
  pro: { monthly: 26.66, yearlyEffectiveMonthly: 22.22 },
  business: { monthly: 99.99, yearlyEffectiveMonthly: 83.33 },
}

export function formatEuro(amount: number): string {
  return `€${amount.toFixed(2)}`
}

export function yearlyTotal(plan: SubscriptionPlan): number {
  return Math.round(PLAN_PRICING[plan].yearlyEffectiveMonthly * 12 * 100) / 100
}
```

- [ ] **Step 4: Rewrite BillingPage.tsx**

Replace `frontend/src/features/billing/pages/BillingPage.tsx`:

```tsx
import { AlertTriangle, Check, CreditCard, Loader2, Minus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { EmptyState } from '@/components/common/EmptyState'
import { CardGridSkeleton } from '@/components/common/LoadingSkeleton'
import type { BillingInterval } from '@/api/billing'
import { UsageBar } from '@/features/billing/components/UsageBar'
import { useBilling, useCreateCheckoutSession, useCreatePortalSession } from '@/features/billing/hooks/useBilling'
import { useCurrentWorkspace } from '@/features/workspaces/hooks/useCurrentWorkspace'
import { formatBytes } from '@/lib/formatBytes'
import { formatEuro, PLAN_PRICING, yearlyTotal } from '@/lib/planPricing'
import { isAdminLevel } from '@/lib/permissions'
import type { BillingData, PlanDetails, SubscriptionPlan } from '@/types'
import type { TFunction } from 'i18next'

const PLAN_ORDER: SubscriptionPlan[] = ['starter', 'pro', 'business']

const FEATURE_ROW_KEYS: { key: keyof PlanDetails; labelKey: string }[] = [
  { key: 'custom_themes', labelKey: 'billing.features.customThemes' },
  { key: 'private_links', labelKey: 'billing.features.privateLinks' },
  { key: 'white_label', labelKey: 'billing.features.whiteLabel' },
  { key: 'custom_domains', labelKey: 'billing.features.customDomains' },
]

function PlanCard({
  plan,
  interval,
  isCurrent,
  canManage,
  onUpgrade,
  isUpgrading,
  t,
}: {
  plan: PlanDetails
  interval: BillingInterval
  isCurrent: boolean
  canManage: boolean
  onUpgrade: () => void
  isUpgrading: boolean
  t: TFunction
}) {
  const pricing = PLAN_PRICING[plan.plan]
  const displayedPrice = interval === 'yearly' ? pricing.yearlyEffectiveMonthly : pricing.monthly

  return (
    <Card className={isCurrent ? 'relative border-primary ring-1 ring-primary' : 'relative'}>
      {plan.plan === 'pro' && (
        <Badge className="absolute -top-2.5 left-1/2 -translate-x-1/2">{t('billing.mostPopular')}</Badge>
      )}
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{plan.label}</CardTitle>
          {isCurrent && <Badge variant="secondary">{t('billing.currentPlan')}</Badge>}
        </div>
        <div className="pt-2">
          {interval === 'yearly' && (
            <p className="text-sm text-muted-foreground line-through">{formatEuro(pricing.monthly)}/{t('billing.perMonth')}</p>
          )}
          <p className="text-3xl font-bold text-foreground">
            {formatEuro(displayedPrice)}
            <span className="text-sm font-normal text-muted-foreground">/{t('billing.perMonth')}</span>
          </p>
          {interval === 'yearly' && (
            <p className="text-xs text-muted-foreground">
              {t('billing.billedAnnually', { amount: formatEuro(yearlyTotal(plan.plan)) })}
            </p>
          )}
        </div>
        <CardDescription>
          {plan.max_epks === null ? t('billing.unlimitedEpks') : t('billing.epkCount', { count: plan.max_epks })} ·{' '}
          {plan.max_team_members === null
            ? t('billing.unlimitedTeamMembers')
            : t('billing.teamMemberCount', { count: plan.max_team_members })}{' '}
          · {formatBytes(plan.max_storage_bytes ?? 0)} {t('billing.storage')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <ul className="space-y-2 text-sm">
          {FEATURE_ROW_KEYS.map((row) => (
            <li key={row.key} className="flex items-center gap-2">
              {plan[row.key] ? (
                <Check className="size-4 shrink-0 text-success" />
              ) : (
                <Minus className="size-4 shrink-0 text-muted-foreground" />
              )}
              <span className={plan[row.key] ? 'text-foreground' : 'text-muted-foreground'}>{t(row.labelKey)}</span>
            </li>
          ))}
        </ul>
        {canManage && !isCurrent && (
          <Button size="sm" className="w-full" disabled={isUpgrading} onClick={onUpgrade}>
            {isUpgrading && <Loader2 className="size-4 animate-spin" />}
            {t('billing.upgradeTo', { plan: plan.label })}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

function SubscriptionStatusBanner({ billing, t }: { billing: BillingData; t: TFunction }) {
  if (billing.subscription_status === 'past_due') {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
        <AlertTriangle className="size-4 shrink-0" />
        {t('billing.pastDueWarning')}
      </div>
    )
  }

  if (billing.subscription_status === 'trialing' && billing.trial_ends_at) {
    const daysLeft = Math.max(0, Math.ceil((new Date(billing.trial_ends_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))

    return (
      <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm text-foreground">
        {t('billing.trialDaysLeft', { count: daysLeft })}
      </div>
    )
  }

  return null
}

export function BillingPage() {
  const { t } = useTranslation()
  const [searchParams, setSearchParams] = useSearchParams()
  const [interval, setInterval] = useState<BillingInterval>('monthly')
  const { currentWorkspace, isLoading: workspaceLoading } = useCurrentWorkspace()
  const { data: billing, isLoading } = useBilling(currentWorkspace?.id)
  const checkout = useCreateCheckoutSession(currentWorkspace?.id ?? 0)
  const portal = useCreatePortalSession(currentWorkspace?.id ?? 0)

  // Stripe redirects back here after Checkout — the actual plan change
  // itself only lands once the webhook fires (often a beat after this
  // redirect), so this is just an acknowledgement toast, not a source of
  // truth; useBilling() above will reflect the real state on its own once
  // the webhook has landed and this page is revisited or refetches.
  useEffect(() => {
    const checkoutResult = searchParams.get('checkout')
    if (!checkoutResult) return

    if (checkoutResult === 'success') {
      toast.success(t('billing.checkoutSuccess'))
    } else if (checkoutResult === 'canceled') {
      toast(t('billing.checkoutCanceled'))
    }

    const next = new URLSearchParams(searchParams)
    next.delete('checkout')
    setSearchParams(next, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (workspaceLoading || isLoading) {
    return <CardGridSkeleton />
  }

  if (!currentWorkspace || !billing) {
    return (
      <EmptyState
        icon={CreditCard}
        title={t('common.noWorkspaceYet')}
        description={t('billing.emptyState.noWorkspaceDescription')}
      />
    )
  }

  const canManage = isAdminLevel(currentWorkspace.my_role)

  const startCheckout = (plan: SubscriptionPlan) => {
    checkout.mutate(
      { plan, interval },
      {
        onSuccess: (url) => {
          window.location.href = url
        },
        onError: () => toast.error(t('billing.checkoutError')),
      }
    )
  }

  const openPortal = () => {
    portal.mutate(undefined, {
      onSuccess: (url) => {
        window.location.href = url
      },
      onError: () => toast.error(t('billing.portalError')),
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-foreground">{t('nav.billing')}</h1>
          <p className="text-sm text-muted-foreground">
            {t('billing.pageDescription', { workspace: currentWorkspace.name, plan: billing.plans[billing.plan].label })}
          </p>
        </div>
        {canManage && billing.has_stripe_customer && (
          <Button variant="outline" size="sm" disabled={portal.isPending} onClick={openPortal}>
            {portal.isPending && <Loader2 className="size-4 animate-spin" />}
            {t('billing.manageBilling')}
          </Button>
        )}
      </div>

      <SubscriptionStatusBanner billing={billing} t={t} />

      <Card>
        <CardHeader>
          <CardTitle>{t('billing.usage.title')}</CardTitle>
          <CardDescription>{t('billing.usage.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <UsageBar label={t('billing.usage.epks')} used={billing.usage.epks.used} limit={billing.usage.epks.limit} />
          <UsageBar
            label={t('billing.usage.teamMembers')}
            used={billing.usage.team_members.used}
            limit={billing.usage.team_members.limit}
          />
          <UsageBar
            label={t('billing.usage.storage')}
            used={billing.usage.storage_bytes.used}
            limit={billing.usage.storage_bytes.limit}
            formatValue={formatBytes}
          />
        </CardContent>
      </Card>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-heading text-lg font-semibold text-foreground">{t('billing.plans')}</h2>
          <div className="flex items-center gap-2 text-sm">
            <span className={interval === 'monthly' ? 'text-foreground' : 'text-muted-foreground'}>{t('billing.monthly')}</span>
            <Switch
              checked={interval === 'yearly'}
              onCheckedChange={(checked) => setInterval(checked ? 'yearly' : 'monthly')}
              aria-label={t('billing.yearly')}
            />
            <span className={interval === 'yearly' ? 'text-foreground' : 'text-muted-foreground'}>{t('billing.yearly')}</span>
          </div>
        </div>
        <div className="grid gap-4 pt-3 md:grid-cols-3">
          {PLAN_ORDER.map((plan) => (
            <PlanCard
              key={plan}
              plan={billing.plans[plan]}
              interval={interval}
              isCurrent={plan === billing.plan}
              canManage={canManage}
              isUpgrading={checkout.isPending && checkout.variables?.plan === plan}
              onUpgrade={() => startCheckout(plan)}
              t={t}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd frontend && npx vitest run src/features/billing/pages/BillingPage.test.tsx`
Expected: PASS. If the `Switch` component's accessible role/name doesn't match `getByRole('switch', { name: /yearly/i })`, check `frontend/src/components/ui/switch.tsx`'s actual rendered output and adjust the test's query to match (e.g. it may need `aria-labelledby` wiring instead of a direct `aria-label` for the accessible name to resolve correctly) — fix the query, not the component, unless the component's accessibility is itself broken.

- [ ] **Step 6: Full frontend verification**

Run, in order:
```bash
cd frontend
npx tsc -b
npm run test -- --run
npm run lint
```
Expected: all three clean. tsc should now be fully clean (Task 10's expected failures are resolved by this task's changes).

- [ ] **Step 7: Commit**

```bash
cd frontend
git add src/features/billing/pages/BillingPage.tsx src/features/billing/pages/BillingPage.test.tsx src/lib/planPricing.ts
git commit -m "Redesign BillingPage: monthly/yearly toggle, trial banner, three-tier pricing cards"
```

---

## Task 12: Lockout redirect — 402 from the backend sends the whole app to Billing

**Files:**
- Modify: `frontend/src/api/client.ts`
- Modify: `frontend/src/App.tsx`

**Interfaces:**
- Consumes: `402` HTTP status from any API call (Task 7's middleware)
- Produces: a `subscriptionLocked` flag surfaced via the auth-invalidation mechanism already in `api/client.ts`, read by a redirect check in `App.tsx`.

- [ ] **Step 1: Write the failing test**

There isn't an existing test file for `api/client.ts`'s interceptor behavior to extend — write a new one at `frontend/src/api/client.test.ts`:

```typescript
import { describe, expect, it, vi } from 'vitest'
import { HttpResponse, http } from 'msw'
import { apiClient, registerSubscriptionLockedHandler } from '@/api/client'
import { server } from '@/test/server'

const API_URL = 'http://localhost:8000'

describe('apiClient 402 handling', () => {
  it('calls the registered handler when a request comes back 402', async () => {
    server.use(http.get(`${API_URL}/api/workspaces/1`, () => HttpResponse.json({ message: 'locked' }, { status: 402 })))

    const handler = vi.fn()
    registerSubscriptionLockedHandler(handler)

    await expect(apiClient.get('/api/workspaces/1')).rejects.toThrow()
    expect(handler).toHaveBeenCalledOnce()
  })
})
```

Note: the handler itself takes no arguments — it's a pure "you're locked out, go to Billing" signal. The backend's 402 body does carry an English message (`EnsureSubscriptionIsActive`'s `abort(402, ...)` text from Task 7), but that string comes from Laravel's own `__()` helper with no translation file behind it, so it's not locale-aware the way the rest of this app's UI is (see the 7-locale i18n system) — showing it directly would silently break translation parity. The frontend shows its own translated toast instead (Step 4 below), ignoring the backend's message text entirely.

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npx vitest run src/api/client.test.ts`
Expected: FAIL — `registerSubscriptionLockedHandler` doesn't exist yet.

- [ ] **Step 3: Add the 402 handler to the interceptor**

In `frontend/src/api/client.ts`, add alongside the existing `registerAuthInvalidator` pattern at the bottom of the file:

```typescript
// Set lazily by App.tsx to avoid a circular import between the api client
// and the router. Fires on any 402 from the backend -- the access-gate
// middleware's signal that this workspace's trial expired or its
// subscription was canceled, with nothing active to replace it.
let subscriptionLockedHandler: (() => void) | null = null
export function registerSubscriptionLockedHandler(fn: () => void) {
  subscriptionLockedHandler = fn
}
```

And in the existing response interceptor (the `apiClient.interceptors.response.use(...)` block), add a branch alongside the existing `419`/`401` handling:

```typescript
    if (status === 402) {
      subscriptionLockedHandler?.()
    }
```

(Add this check in the same `async (error: AxiosError) => { ... }` handler, after the existing `419` retry block and before the `return Promise.reject(error)` at the end -- it doesn't retry anything, just notifies, so it can go anywhere in that function body before the final return.)

- [ ] **Step 4: Wire the handler in App.tsx to redirect, with an explanatory toast**

Read `frontend/src/App.tsx` first to see its current structure (router setup, where `registerAuthInvalidator` is already called from, if it is) and add a matching `useEffect` that calls `registerSubscriptionLockedHandler` with a callback navigating to `/billing` -- for example, if the file already has a `QueryProvider`/`AuthProvider` wrapper component that calls `registerAuthInvalidator` in a `useEffect`, add this in the same place:

```typescript
useEffect(() => {
  registerSubscriptionLockedHandler(() => {
    if (window.location.pathname !== '/billing') {
      toast.error(t('billing.lockedOut'))
      window.location.href = '/billing'
    }
  })
}, [t])
```

(A full-page `window.location.href` redirect rather than a React Router `navigate()` call is deliberate here: this fires from inside an axios interceptor, potentially mid-render of an arbitrary page that has no idea it's about to be yanked away -- a hard navigation is simpler and more reliable than threading a router-aware callback through every possible call site. Add the `registerSubscriptionLockedHandler` import at the top of the file next to wherever `registerAuthInvalidator` is already imported from `@/api/client`, and make sure `t` comes from `useTranslation()` and `toast` from `sonner` in this component -- both are already used elsewhere in this codebase, e.g. `BillingPage.tsx` from Task 11, so follow that same import pattern. The `billing.lockedOut` key is added across all 7 locales in Task 13.)

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd frontend && npx vitest run src/api/client.test.ts`
Expected: PASS

- [ ] **Step 6: Full frontend verification**

Run:
```bash
cd frontend
npx tsc -b
npm run test -- --run
npm run lint
```
Expected: all clean.

- [ ] **Step 7: Commit**

```bash
cd frontend
git add src/api/client.ts src/api/client.test.ts src/App.tsx
git commit -m "Redirect to Billing on 402 (trial expired / subscription canceled)"
```

---

## Task 13: i18n — new billing keys across all 7 locales

**Files:**
- Modify: `frontend/src/i18n/locales/en.json`
- Modify: `frontend/src/i18n/locales/fr.json`
- Modify: `frontend/src/i18n/locales/es.json`
- Modify: `frontend/src/i18n/locales/pt.json`
- Modify: `frontend/src/i18n/locales/de.json`
- Modify: `frontend/src/i18n/locales/ar.json`
- Modify: `frontend/src/i18n/locales/zh.json`

**Interfaces:**
- Consumes: every `t('billing.*')` key referenced in Task 11's `BillingPage.tsx` that doesn't already exist in the current locale files.
- Produces: nothing consumed further -- this is the last task.

- [ ] **Step 1: Identify exactly which keys are new**

The existing `billing.*` block already has: `currentPlan`, `unlimitedEpks`, `epkCount_one/_other`, `unlimitedTeamMembers`, `teamMemberCount_one/_other`, `storage`, `pageDescription`, `plans`, `upgradeTo`, `manageBilling`, `pastDueWarning`, `checkoutSuccess`, `checkoutCanceled`, `checkoutError`, `portalError`, `usage.*`, `features.*`, `emptyState.*`. New keys Task 11 introduced: `mostPopular`, `perMonth`, `billedAnnually`, `monthly`, `yearly`, `trialDaysLeft_one`/`trialDaysLeft_other`. Task 12 introduced one more: `lockedOut` (the toast shown on a hard 402 redirect to Billing).

- [ ] **Step 2: Add the new keys to en.json**

In `frontend/src/i18n/locales/en.json`, inside the existing `"billing": { ... }` block, add (position doesn't matter, e.g. right after `"manageBilling"`):

```json
    "mostPopular": "Most Popular",
    "perMonth": "month",
    "billedAnnually": "Billed annually ({{amount}}/year)",
    "monthly": "Monthly",
    "yearly": "Yearly",
    "trialDaysLeft_one": "{{count}} day left in your trial — choose a plan to keep your workspace after it ends.",
    "trialDaysLeft_other": "{{count}} days left in your trial — choose a plan to keep your workspace after it ends.",
    "lockedOut": "Your trial has ended. Choose a plan to keep using this workspace.",
```

- [ ] **Step 3: Add the equivalent keys to the other 6 locales**

In each of `fr.json`, `es.json`, `pt.json`, `de.json`, `ar.json`, `zh.json`, inside their own existing `"billing": { ... }` block (same anchor point as en.json -- right after `"manageBilling"`), add:

**fr.json:**
```json
    "mostPopular": "Le plus populaire",
    "perMonth": "mois",
    "billedAnnually": "Facturé annuellement ({{amount}}/an)",
    "monthly": "Mensuel",
    "yearly": "Annuel",
    "trialDaysLeft_one": "Il vous reste {{count}} jour d'essai — choisissez un pack pour garder votre espace de travail après.",
    "trialDaysLeft_other": "Il vous reste {{count}} jours d'essai — choisissez un pack pour garder votre espace de travail après.",
    "lockedOut": "Votre essai est terminé. Choisissez un pack pour continuer à utiliser cet espace de travail.",
```

**es.json:**
```json
    "mostPopular": "Más popular",
    "perMonth": "mes",
    "billedAnnually": "Facturado anualmente ({{amount}}/año)",
    "monthly": "Mensual",
    "yearly": "Anual",
    "trialDaysLeft_one": "Te queda {{count}} día de prueba — elige un plan para conservar tu espacio de trabajo.",
    "trialDaysLeft_other": "Te quedan {{count}} días de prueba — elige un plan para conservar tu espacio de trabajo.",
    "lockedOut": "Tu prueba ha terminado. Elige un plan para seguir usando este espacio de trabajo.",
```

**pt.json:**
```json
    "mostPopular": "Mais popular",
    "perMonth": "mês",
    "billedAnnually": "Faturado anualmente ({{amount}}/ano)",
    "monthly": "Mensal",
    "yearly": "Anual",
    "trialDaysLeft_one": "Resta-lhe {{count}} dia de avaliação — escolha um plano para manter o seu espaço de trabalho.",
    "trialDaysLeft_other": "Restam-lhe {{count}} dias de avaliação — escolha um plano para manter o seu espaço de trabalho.",
    "lockedOut": "O seu período de avaliação terminou. Escolha um plano para continuar a usar este espaço de trabalho.",
```

**de.json:**
```json
    "mostPopular": "Am beliebtesten",
    "perMonth": "Monat",
    "billedAnnually": "Jährlich abgerechnet ({{amount}}/Jahr)",
    "monthly": "Monatlich",
    "yearly": "Jährlich",
    "trialDaysLeft_one": "Noch {{count}} Tag Ihrer Testphase — wählen Sie einen Tarif, um Ihren Arbeitsbereich zu behalten.",
    "trialDaysLeft_other": "Noch {{count}} Tage Ihrer Testphase — wählen Sie einen Tarif, um Ihren Arbeitsbereich zu behalten.",
    "lockedOut": "Ihre Testphase ist abgelaufen. Wählen Sie einen Tarif, um diesen Arbeitsbereich weiter zu nutzen.",
```

**ar.json:**
```json
    "mostPopular": "الأكثر شيوعًا",
    "perMonth": "شهر",
    "billedAnnually": "تُفوتر سنويًا ({{amount}}/سنة)",
    "monthly": "شهري",
    "yearly": "سنوي",
    "trialDaysLeft_one": "تبقّى {{count}} يوم من فترتك التجريبية — اختر باقة للاحتفاظ بمساحة العمل.",
    "trialDaysLeft_other": "تبقّى {{count}} أيام من فترتك التجريبية — اختر باقة للاحتفاظ بمساحة العمل.",
    "lockedOut": "انتهت فترتك التجريبية. اختر باقة لمواصلة استخدام مساحة العمل هذه.",
```

**zh.json:**
```json
    "mostPopular": "最受欢迎",
    "perMonth": "月",
    "billedAnnually": "按年计费（{{amount}}/年）",
    "monthly": "按月",
    "yearly": "按年",
    "trialDaysLeft_one": "试用还剩 {{count}} 天 — 选择一个套餐以保留您的工作区。",
    "trialDaysLeft_other": "试用还剩 {{count}} 天 — 选择一个套餐以保留您的工作区。",
    "lockedOut": "您的试用已结束。请选择一个套餐以继续使用此工作区。",
```

- [ ] **Step 4: Verify JSON validity and key parity across all 7 locales**

Run:
```bash
cd frontend/src/i18n/locales
node -e "
const fs = require('fs');
const files = ['en','fr','es','pt','de','ar','zh'];
function flatten(obj, prefix = '') {
  let keys = [];
  for (const k in obj) {
    const path = prefix ? prefix + '.' + k : k;
    if (obj[k] && typeof obj[k] === 'object' && !Array.isArray(obj[k])) {
      keys = keys.concat(flatten(obj[k], path));
    } else {
      keys.push(path);
    }
  }
  return keys;
}
const data = {};
for (const f of files) data[f] = JSON.parse(fs.readFileSync(f + '.json', 'utf8'));
const enKeys = new Set(flatten(data.en));
for (const f of files) {
  if (f === 'en') continue;
  const keys = new Set(flatten(data[f]));
  const missing = [...enKeys].filter(k => !keys.has(k));
  const extra = [...keys].filter(k => !enKeys.has(k));
  console.log(f + ': ' + (missing.length || extra.length ? 'missing=' + JSON.stringify(missing) + ' extra=' + JSON.stringify(extra) : 'OK'));
}
"
```
Expected: `OK` for all 6 non-English locales, no missing/extra keys.

- [ ] **Step 5: Full frontend verification one final time**

Run:
```bash
cd frontend
npx tsc -b
npm run test -- --run
npm run build
npm run lint
```
Expected: all clean, including a successful production build.

- [ ] **Step 6: Commit**

```bash
cd frontend
git add src/i18n/locales/en.json src/i18n/locales/fr.json src/i18n/locales/es.json src/i18n/locales/pt.json src/i18n/locales/de.json src/i18n/locales/ar.json src/i18n/locales/zh.json
git commit -m "Add billing i18n keys for the monthly/yearly toggle and trial banner"
```

---

## Task 14: Update docs/stripe.md for the six-price setup

**Files:**
- Modify: `docs/stripe.md`

**Interfaces:**
- Consumes: nothing (documentation only).

- [ ] **Step 1: Update the Product/Price creation section**

In `docs/stripe.md`, find the section describing creating one Product/Price per paid tier (originally "Pro" and "Business", one price each) and replace it with instructions for three products (Starter/Pro/Business), each needing **two** prices (monthly and yearly):

```markdown
## 3. Create a Product with two Prices for each pack

Dashboard → **Product catalog → Add product**. KORAX has three packs (`config/plans.php`) — create one Product per pack, each with **two** recurring Prices attached (monthly and yearly):

1. **Starter** — €6.66/month recurring, plus a second price: €66.60/year recurring (yearly interval, billed as one annual charge — not a monthly price with a discount).
2. **Pro** — €26.66/month, plus €266.64/year.
3. **Business** — €99.99/month, plus €999.96/year.

For each price you create, copy its id (`price_1AbCdEfGhIjKlMnO`) — you'll need all six.
```

And update the `.env` block further down (in the "Set the environment variables" section) to:

```bash
STRIPE_KEY=pk_test_...
STRIPE_SECRET=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_STARTER_MONTHLY=price_...
STRIPE_PRICE_STARTER_YEARLY=price_...
STRIPE_PRICE_PRO_MONTHLY=price_...
STRIPE_PRICE_PRO_YEARLY=price_...
STRIPE_PRICE_BUSINESS_MONTHLY=price_...
STRIPE_PRICE_BUSINESS_YEARLY=price_...
```

- [ ] **Step 2: Update the "What an admin plan override still does" section's plan names**

Find any remaining mention of "Free" plan in the doc (e.g. in the testing walkthrough or the admin-override section) and update to reflect that a new workspace starts on a 14-day trial, not a Free plan, and that an admin override sets `plan` directly the same way as before (Starter/Pro/Business, no Free option any more).

- [ ] **Step 3: Commit**

```bash
git add docs/stripe.md
git commit -m "docs: update Stripe setup for three packs x two billing intervals"
```
