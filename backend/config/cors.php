<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Cross-Origin Resource Sharing (CORS) Configuration
    |--------------------------------------------------------------------------
    |
    | Here you may configure your settings for cross-origin resource sharing
    | or "CORS". This determines what cross-origin operations may execute
    | in web browsers. You are free to adjust these settings as needed.
    |
    | To learn more: https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS
    |
    */

    'paths' => ['api/*', 'sanctum/csrf-cookie'],

    'allowed_methods' => ['*'],

    'allowed_origins' => array_filter(explode(',', (string) env('FRONTEND_URL', ''))),

    'allowed_origins_patterns' => [],

    'allowed_headers' => ['*'],

    // Content-Disposition isn't on the browser's default cross-origin-visible
    // header allowlist -- without exposing it explicitly, JS reading
    // response.headers['content-disposition'] (e.g. the builder's "Download
    // PDF" button, which fetches through axios rather than a plain <a href>
    // so Sanctum's cookie auth actually attaches) always comes back
    // undefined, silently falling back to a generic filename instead of the
    // real one the backend already sends.
    // Content-Disposition isn't on the browser's default cross-origin-visible
    // header allowlist -- without exposing it explicitly, JS reading
    // response.headers['content-disposition'] (e.g. the builder's "Download
    // PDF" button, which fetches through axios rather than a plain <a href>
    // so Sanctum's cookie auth actually attaches) always comes back
    // undefined, silently falling back to a generic filename instead of the
    // real one the backend already sends.
    'exposed_headers' => ['Content-Disposition'],

    'max_age' => 0,

    'supports_credentials' => true,

];
