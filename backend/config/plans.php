<?php

/*
|--------------------------------------------------------------------------
| Subscription Plans
|--------------------------------------------------------------------------
|
| The static feature/limit table for each plan tier. This is deliberately a
| config file rather than a database table — these three tiers are product
| decisions, not admin-editable data, much like Stripe Price/Product objects
| aren't edited from inside the app that sells them.
|
| 'stripe_price_id' is the Stripe Price object id for that tier's recurring
| subscription (see docs/stripe.md for how to create these in the Stripe
| Dashboard and where to put the id) — null for Free since there's nothing
| to check out for it. An admin can still set a workspace's plan directly
| via /admin/workspaces/{workspace}/subscription regardless of Stripe (e.g.
| comps, manual grants); that path doesn't touch Stripe at all.
|
| 'white_label' is recorded here as a plan flag but has no enforcement
| point yet — that feature doesn't exist in the app at all, so there's
| nothing to gate. It's included so the comparison table is honest about
| what each tier is eventually meant to unlock.
|
| 'custom_domains' gates EpkCustomDomainController (see PlanLimits::
| canUseCustomDomains()) — DNS/SSL for the domain itself is still a manual
| step on the host, this only controls who's allowed to attach one.
|
*/

return [

    'free' => [
        'label' => 'Free',
        'max_epks' => 1,
        'max_storage_bytes' => 500 * 1024 * 1024, // 500 MB
        'max_team_members' => 2,
        'custom_themes' => false,
        'private_links' => false,
        'white_label' => false,
        'custom_domains' => false,
        'stripe_price_id' => null,
    ],

    'pro' => [
        'label' => 'Pro',
        'max_epks' => 10,
        'max_storage_bytes' => 10 * 1024 * 1024 * 1024, // 10 GB
        'max_team_members' => 10,
        'custom_themes' => true,
        'private_links' => true,
        'white_label' => false,
        'custom_domains' => false,
        'stripe_price_id' => env('STRIPE_PRICE_PRO'),
    ],

    'business' => [
        'label' => 'Business',
        'max_epks' => null, // unlimited
        'max_storage_bytes' => 100 * 1024 * 1024 * 1024, // 100 GB
        'max_team_members' => null, // unlimited
        'custom_themes' => true,
        'private_links' => true,
        'white_label' => true,
        'custom_domains' => true,
        'stripe_price_id' => env('STRIPE_PRICE_BUSINESS'),
    ],

];
