# Stripe Billing Setup

How to configure real subscriptions for KORAX. The app talks to Stripe directly via the official `stripe/stripe-php` SDK (not Laravel Cashier — see the comment at the top of `App\Services\StripeBillingService` for why), so there's no extra package config beyond the environment variables below.

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

## 3. Create a Product and a Price for each paid plan

Dashboard → **Product catalog → Add product**. KORAX has two paid tiers (`config/plans.php`) — create one Product per tier:

1. **Pro** — set a recurring monthly price (whatever you want to charge). Save, then open the price you just created and copy its id — it looks like `price_1AbCdEfGhIjKlMnO`.
2. **Business** — same steps, its own price.

(Free has no Stripe price — there's nothing to check out for it.)

## 4. Set the environment variables

In `backend/.env`:

```bash
STRIPE_KEY=pk_test_...
STRIPE_SECRET=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...        # from step 5 below
STRIPE_PRICE_PRO=price_...             # the Pro price id from step 3
STRIPE_PRICE_BUSINESS=price_...        # the Business price id from step 3
```

If `APP_ENV=production` and you've run `php artisan optimize` (which caches config), re-run `php artisan config:cache` after changing any of these — a cached config won't pick up a `.env` edit otherwise.

## 5. Create the webhook endpoint

This is what lets a workspace's plan update automatically the moment someone pays, upgrades, downgrades, or cancels — without it, Checkout would still take their money but the app would never find out.

Dashboard → **Developers → Webhooks → Add endpoint**:

- **Endpoint URL**: `https://api.karthagopm.com/api/stripe/webhook` (or wherever your backend is deployed — see [`cpanel-deployment.md`](cpanel-deployment.md) for the subdomain split this app expects)
- **Events to send** — select exactly these three:
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`

  (A failed payment doesn't need its own event: Stripe already flips the subscription's `status` to `past_due` and fires `customer.subscription.updated`, which the app already listens for.)

After creating the endpoint, click into it and reveal the **Signing secret** (`whsec_...`) → that's your `STRIPE_WEBHOOK_SECRET`. This is what `StripeWebhookController` uses to verify a request genuinely came from Stripe and not a forged POST to a guessed URL — nothing about this endpoint requires being logged in, so this signature check is the entire security model for it.

## 6. Test it end-to-end

With `STRIPE_KEY`/`STRIPE_SECRET` still in **test mode**:

1. From a workspace's Billing page, click **Upgrade to Pro**.
2. On Stripe's Checkout page, use a [test card](https://docs.stripe.com/testing#cards) — `4242 4242 4242 4242`, any future expiry, any CVC, any postal code.
3. After paying, you're redirected back to `/billing?checkout=success`. The plan itself updates a moment later once the webhook lands — refresh if it hasn't shown up within a few seconds.
4. Click **Manage billing** to confirm the Stripe Customer Portal opens and shows the subscription.
5. To test cancellation syncing back down to Free: cancel the subscription from the portal, then check the workspace's plan reverts.

If you have the [Stripe CLI](https://docs.stripe.com/stripe-cli) installed, `stripe listen --forward-to localhost:8000/api/stripe/webhook` lets you test the whole flow against your local dev server before deploying anywhere — it prints its own webhook signing secret when it starts, which you'd use as `STRIPE_WEBHOOK_SECRET` for that local session only (don't confuse it with your real Dashboard-created endpoint's secret).

## 7. Going live

Once you're happy in test mode: flip the Dashboard to **Live mode**, redo steps 2–5 there (live keys, live Product/Price ids, a *second* webhook endpoint pointing at the same URL — test and live mode each need their own), and swap every `STRIPE_*` value in production's `.env` for the live ones. Test-mode and live-mode data are completely separate in Stripe, including customers and subscriptions, so nothing from your testing carries over (which is exactly what you want).

## What an admin plan override still does

Manually setting a workspace's plan via `/admin/workspaces/{workspace}/subscription` (the admin panel) never touches Stripe at all — it's a direct database write, meant for comps, manual grants, or fixing a support issue. It doesn't create a Stripe customer or subscription, so a workspace an admin bumped to Pro this way won't show a **Manage billing** button until it actually has a real Stripe subscription (i.e., someone has gone through Checkout at least once).
