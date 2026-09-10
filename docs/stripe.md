# Stripe Billing Setup

How to configure real subscriptions for KORAXX. The app talks to Stripe directly via the official `stripe/stripe-php` SDK (not Laravel Cashier — see the comment at the top of `App\Services\StripeBillingService` for why), so there's no extra package config beyond the environment variables below.

Three things happen once this is wired up:
- A workspace owner/admin clicks **Upgrade** on the Billing page → redirected to a Stripe-hosted Checkout page.
- After paying, Stripe calls your backend's webhook → the workspace's plan updates automatically (no polling, no manual step).
- **Manage billing** opens Stripe's hosted Customer Portal, where the same owner/admin can update their card, see invoices, switch plans, or cancel — all without any of that needing to be built in this app.

## 1. Create a Stripe account

If you don't have one already: [stripe.com](https://stripe.com) → sign up. Every account starts in **Test mode** (toggle in the Dashboard's top-right) — build and verify everything in test mode first, then repeat the API-key and webhook steps below for live mode when you're ready to charge real cards.

## 2. Get your API keys

Dashboard → **Developers → API keys**:

- **Publishable key** (`pk_test_...` / `pk_live_...`) → `STRIPE_KEY` (the backend doesn't currently render anything client-side with this, but it's conventional to have it set)
- **Secret key** (`sk_test_...` / `sk_live_...`) → `STRIPE_SECRET` — never commit this or share it; treat it like a password

## 3. Create a Product with two Prices for each pack

Dashboard → **Product catalog → Add product**. KORAXX has three packs (`config/plans.php`) — create one Product per pack, each with **two** recurring Prices attached (monthly and yearly):

1. **Starter** — €6.66/month recurring, plus a second price: €66.60/year recurring (yearly interval, billed as one annual charge — not a monthly price with a discount).
2. **Pro** — €26.66/month, plus €266.64/year.
3. **Business** — €99.99/month, plus €999.96/year.

For each price you create, copy its id (`price_1AbCdEfGhIjKlMnO`) — you'll need all six.

## 4. Set the environment variables

In `backend/.env`:

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

If `APP_ENV=production` and you've run `php artisan optimize` (which caches config), re-run `php artisan config:cache` after changing any of these — a cached config won't pick up a `.env` edit otherwise.

## 5. Create the webhook endpoint

This is what lets a workspace's plan update automatically the moment someone pays, upgrades, downgrades, or cancels — without it, Checkout would still take their money but the app would never find out.

Dashboard → **Developers → Webhooks → Add endpoint**:

- **Endpoint URL**: `https://api.karthagopm.com/api/stripe/webhook` (or wherever your backend is deployed — see [`cpanel-deployment.md`](cpanel-deployment.md) for the subdomain split this app expects)
- **Events to send** — select exactly these four:
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.payment_action_required` — a mid-cycle charge that needs the cardholder to authenticate (3-D Secure). The app emails them a link to complete it.

  (A plain failed payment doesn't need its own event: Stripe flips the subscription's `status` to `past_due` and fires `customer.subscription.updated`, which the app already listens for. The `billing:reconcile` cron job is a safety net for *missed* webhooks — not a substitute for subscribing to the right events here.)

After creating the endpoint, click into it and reveal the **Signing secret** (`whsec_...`) → that's your `STRIPE_WEBHOOK_SECRET`. This is what `StripeWebhookController` uses to verify a request genuinely came from Stripe and not a forged POST to a guessed URL — nothing about this endpoint requires being logged in, so this signature check is the entire security model for it.

### Also configure in the Dashboard (not code)

These aren't `.env` values but the billing flow depends on them:

- **Customer portal** (Settings → Billing → Customer portal): turn on "Update payment method", "Cancel subscription", and "Switch plans" (and add every Price you sell). The app's **Manage billing** button opens this portal and nothing else — if plan-switching isn't enabled here, that button can't change plans.
- **Failed-payment retries** (Settings → Billing → Manage failed payments): choose how many times / over how many days Stripe retries a failed charge, and what happens when it gives up — **mark the subscription `unpaid` or cancel it**. The app treats `past_due` as a grace period with full access; that grace only ends when Stripe moves the subscription to `unpaid`/`canceled`, so "leave it `past_due` forever" would mean the workspace never locks.
- **Customer emails** (Settings → Emails): enable "Successful payments" (receipts) and "Failed payments" if you want Stripe's own transactional emails alongside the app's.
- **Stripe Tax** (Settings → Tax): if you sell to EU customers, VAT is a legal obligation. Enable Stripe Tax or handle VAT manually — the app doesn't.

## 6. Test it end-to-end

With `STRIPE_KEY`/`STRIPE_SECRET` still in **test mode**:

1. From a workspace's Billing page, click **Upgrade to Pro**.
2. On Stripe's Checkout page, use a [test card](https://docs.stripe.com/testing#cards) — `4242 4242 4242 4242`, any future expiry, any CVC, any postal code.
3. After paying, you're redirected back to `/billing?checkout=success`. The plan itself updates a moment later once the webhook lands — refresh if it hasn't shown up within a few seconds.
4. Click **Manage billing** to confirm the Stripe Customer Portal opens and shows the subscription.
5. To test cancellation syncing: cancel the subscription from the portal, then check the workspace's subscription status becomes `canceled`. There's no reverting to a trial — a canceled workspace is hard-locked out (same as an expired trial) until someone subscribes again through Checkout.

If you have the [Stripe CLI](https://docs.stripe.com/stripe-cli) installed, `stripe listen --forward-to localhost:8000/api/stripe/webhook` lets you test the whole flow against your local dev server before deploying anywhere — it prints its own webhook signing secret when it starts, which you'd use as `STRIPE_WEBHOOK_SECRET` for that local session only (don't confuse it with your real Dashboard-created endpoint's secret).

## 7. Going live

Once you're happy in test mode: flip the Dashboard to **Live mode**, redo steps 2–5 there (live keys, live Product/Price ids, a *second* webhook endpoint pointing at the same URL — test and live mode each need their own), and swap every `STRIPE_*` value in production's `.env` for the live ones. Test-mode and live-mode data are completely separate in Stripe, including customers and subscriptions, so nothing from your testing carries over (which is exactly what you want).

## What an admin plan override still does

Manually setting a workspace's plan via `/admin/workspaces/{workspace}/subscription` (the admin panel) never touches Stripe at all — it's a direct database write, meant for comps, manual grants, or fixing a support issue. Any of the three packs (Starter, Pro, or Business) is a valid override target. Alongside `plan`, it also sets the subscription's status to `active` and clears `trial_ends_at` — that's what actually unlocks a workspace that was locked out (an expired trial or a canceled subscription): the access-gate middleware keys off status/trial_ends_at, not plan, so writing plan alone wouldn't have unlocked anything. It doesn't create a Stripe customer or subscription, so a workspace an admin bumped this way won't show a **Manage billing** button until it actually has a real Stripe subscription (i.e., someone has gone through Checkout at least once).
