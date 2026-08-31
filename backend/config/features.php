<?php

// Small, explicit on/off switches for optional features — not meant to grow
// into a general feature-flag system, just a couple of reversible kill
// switches for things that occasionally need to be turned off without a
// code change/deploy.
return [
    // Personal access tokens (Settings → API Tokens). Turning this off
    // rejects *already-issued* tokens too, not just new ones — see
    // App\Http\Middleware\RejectDisabledApiTokens.
    'api_tokens' => env('FEATURE_API_TOKENS_ENABLED', true),
];
