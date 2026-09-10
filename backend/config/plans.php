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
| There is no Free tier. Every new workspace gets a 14-day trial at
| Starter-tier limits and features (see Workspace::booted()) with no Stripe
| object created at all -- upgrading to Pro/Business (and unlocking private
| links, custom themes, custom domains) requires actually subscribing.
| These configs are only ever read for limit checks and once a real Stripe
| price id needs resolving, either at checkout or from a webhook.
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
        'max_epks' => 1,
        'max_storage_bytes' => 150 * 1024 * 1024, // 150 MB
        'max_team_members' => 2,
        'max_artists' => 1,
        'custom_themes' => false,
        'private_links' => false,
        'white_label' => false,
        'custom_domains' => false,
        'stripe_price_id_monthly' => env('STRIPE_PRICE_STARTER_MONTHLY'),
        'stripe_price_id_yearly' => env('STRIPE_PRICE_STARTER_YEARLY'),
    ],

    'pro' => [
        'label' => 'Pro',
        'max_epks' => 5,
        'max_storage_bytes' => 2 * 1024 * 1024 * 1024, // 2 GB
        'max_team_members' => 10,
        'max_artists' => 5,
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
        'max_artists' => null, // unlimited
        'custom_themes' => true,
        'private_links' => true,
        'white_label' => true,
        'custom_domains' => true,
        'stripe_price_id_monthly' => env('STRIPE_PRICE_BUSINESS_MONTHLY'),
        'stripe_price_id_yearly' => env('STRIPE_PRICE_BUSINESS_YEARLY'),
    ],

];
