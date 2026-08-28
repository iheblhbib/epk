<?php

/*
|--------------------------------------------------------------------------
| Subscription Plans
|--------------------------------------------------------------------------
|
| The static feature/limit table for each plan tier. This is deliberately a
| config file rather than a database table — these three tiers are product
| decisions, not admin-editable data, much like Stripe Price/Product objects
| aren't edited from inside the app that sells them. Stripe integration
| itself is out of scope for this phase (see App\Services\PlanLimits and
| the Subscription model's stripe_* columns, which exist now so wiring
| Stripe in later doesn't need a schema change) — for now a workspace's
| plan is set by an admin via /admin/workspaces/{workspace}/subscription.
|
| 'white_label' and 'custom_domains' are recorded here as plan flags but
| have no enforcement point yet — neither feature exists in the app at all,
| so there's nothing to gate. They're included so the comparison table is
| honest about what each tier is eventually meant to unlock.
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
    ],

];
