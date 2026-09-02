# Subscription billing overhaul — design

**Status:** approved by user, ready for implementation planning
**Date:** 2026-09-02

## Motivation

The current billing model (`config/plans.php`: Free/Pro/Business, a single
flat price per paid plan, no billing-interval concept) is being replaced
with a Haulix-style three-tier trial-to-paid model: no permanent free
plan, a 14-day full-access trial for every new workspace, three paid
packs each offered monthly or billed annually at a discount, and a hard
lockout once the trial ends without a paid subscription.

There are no real users on the current Free plan yet (confirmed by the
user — still pre-launch/test), so this is a clean-slate implementation,
not a migration of existing paying/free customers.

## Reference

Haulix's real pricing page (`secure.haulix.com`, fetched live during
design) was used as the structural reference — 14-day trial, no card
required to start, monthly/yearly toggle with yearly billed as one
annual charge, tiered storage, and a "Most Popular" badge on the
middle tier. Feature *categories* (storage limit, seat count, premium
capabilities gated by tier) were adapted to this app's actual feature
set; Haulix's own features (track file formats, watermarking) don't
apply here and aren't replicated.

## Decisions

- **No permanent free tier.** The `free` plan is removed entirely, not
  kept alongside the three paid packs.
- **Trial: 14 days, no payment method required at signup.** A workspace
  is fully usable the moment it's created, with no Stripe interaction
  until the owner actually chooses to pay.
- **Trial grants full Business-tier limits**, regardless of which pack
  the workspace eventually subscribes to. There's no "pick a pack
  up front, trial that pack's limits" step — everyone previews the top
  tier during the 14 days.
- **Trial expiry with no active subscription = hard lockout.** Every
  workspace-scoped route is blocked except the billing endpoints
  themselves (view plans, start checkout, open the billing portal).
  No read-only fallback.
- **Three packs, EUR pricing, monthly + annual (annual billed as one
  charge/year, not monthly-at-a-discount):**

  | | Starter | Pro | Business |
  |---|---|---|---|
  | Monthly | €6.66/mo | €26.66/mo | €99.99/mo |
  | Annual (effective monthly / actual yearly charge) | €5.55/mo (€66.60/yr) | €22.22/mo (€266.64/yr) | €83.33/mo (€999.96/yr) |
  | Storage | 150 MB | 2 GB | 20 GB |
  | EPKs | 3 | 10 | Unlimited |
  | Team members | 2 | 10 | Unlimited |
  | Custom themes | No | Yes | Yes |
  | Private links | No | Yes | Yes |
  | Custom domains | No | No | Yes |

## Data model changes

- `SubscriptionPlan` enum: `Starter | Pro | Business` (the `Free` case is
  removed — every existing reference to it, including
  `PlanLimits::plan()`'s `?? SubscriptionPlan::Free` fallback and
  `StripeBillingService::handleSubscriptionDeleted()`'s downgrade
  target, needs a new answer — see "Cancellation" below).
- `SubscriptionStatus` enum: add `Trialing` alongside the existing
  `Active | PastDue | Canceled`.
- `subscriptions` table — two new nullable columns:
  - `trial_ends_at` (timestamp) — set to `created_at + 14 days` when the
    row is first created (i.e. at workspace creation, same moment a
    `Subscription` row is created today for Free).
  - `billing_interval` (string, `monthly` | `yearly`) — populated only
    once a real paid subscription exists; stays null through the trial.
- `Workspace::booted()` (or wherever the auto-created `Subscription` row
  currently gets its `plan: free` default) changes to create it with
  `plan: Business, status: Trialing, trial_ends_at: now()->addDays(14)`.
  No Stripe customer/subscription object is created at this point —
  identical to how Free works today, just time-boxed.

## Access gating

A new middleware checks, for workspace-scoped routes, whether the
workspace's subscription is `Active`, or `Trialing` with `trial_ends_at`
still in the future. If neither holds, the request is rejected (403)
with a distinguishable error the frontend uses to redirect to Billing —
except for the billing routes themselves (viewing plans, starting
checkout, opening the Stripe portal), which must stay reachable no
matter what, or a locked-out workspace could never pay to unlock.

Exact route-group wiring (which controllers/routes this middleware
attaches to, and how it resolves "the workspace" from route params that
vary in shape across controllers) is an implementation-plan detail, not
resolved further here.

**Cancellation:** `StripeBillingService::handleSubscriptionDeleted()`
currently downgrades to `SubscriptionPlan::Free` with `status:
Canceled`. With Free gone, cancellation instead sets `status: Canceled`
and leaves `plan` as whatever it last was (irrelevant once canceled,
since the access-gating middleware blocks on `status`, not `plan`) —
the workspace becomes locked out exactly like an expired trial, and
must re-subscribe to regain access.

## Stripe integration

- `config/plans.php`: each plan gets two Stripe price ids instead of
  one — `stripe_price_id_monthly` and `stripe_price_id_yearly`. Six new
  env vars replace the current two:
  `STRIPE_PRICE_STARTER_MONTHLY`, `STRIPE_PRICE_STARTER_YEARLY`,
  `STRIPE_PRICE_PRO_MONTHLY`, `STRIPE_PRICE_PRO_YEARLY`,
  `STRIPE_PRICE_BUSINESS_MONTHLY`, `STRIPE_PRICE_BUSINESS_YEARLY`.
- The annual price is a genuine Stripe recurring price with
  `interval=year` — one invoice per year — not a monthly price with a
  coupon/discount applied.
- `StripeBillingService::createCheckoutSession()` takes an additional
  `interval: 'monthly'|'yearly'` argument and selects the matching
  price id.
- `BillingController`'s checkout endpoint accepts `interval` in the
  request alongside `plan`, validated to those two values.
- `StripeBillingService::planFromPriceId()` becomes a lookup that
  resolves both the plan *and* the interval from the six configured
  price ids (since it's no longer a 1:1 plan→price mapping), so
  `syncFromStripeSubscription()` can populate `billing_interval`
  correctly from a real Stripe webhook payload.

## Frontend (Billing page)

- Monthly/Yearly toggle at the top, mirroring Haulix's; switching it
  changes both the displayed price and which price gets sent to
  checkout.
- Three pricing cards: monthly price shown struck through with the
  yearly-equivalent price large when Yearly is selected, a "Billed
  annually (€X/year)" subtext, a feature checklist per the table above,
  and a "Most Popular" badge on Pro (the middle tier) — matching the
  reference screenshot's visual pattern.
- Trial banner (shown whenever `status=Trialing` and not yet expired):
  "N days left in your trial" with a prominent upgrade CTA.
- Lockout state (trial expired or subscription canceled, no active
  paid plan): the rest of the app redirects to Billing with an
  explanatory message; Billing itself always stays reachable.
- Active-subscriber view: current pack highlighted, "Manage billing"
  button opening the Stripe Customer Portal — unchanged from today's
  behavior.

## Out of scope

- Haulix's fourth "Pro+" tier and its Custom/Enterprise plan — not
  replicated; this app keeps exactly three packs.
- Any migration path for existing Free-plan workspaces — moot, per the
  "no real users yet" confirmation.
- Read-only access after trial expiry — explicitly rejected in favor of
  hard lockout.
