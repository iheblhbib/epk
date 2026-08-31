<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Laravel\Sanctum\PersonalAccessToken;
use Symfony\Component\HttpFoundation\Response;

// Kill switch for personal access tokens, gated by config('features.api_tokens')
// (see config/features.php). The SPA's own cookie session is never touched
// by this — currentAccessToken() only returns a real PersonalAccessToken
// instance when the request authenticated via a Bearer token; the stateful
// SPA guard resolves to Sanctum's TransientToken instead, which this
// deliberately doesn't match. That's what lets this block *every* API call
// made with an existing token (not just the token-management endpoints)
// while the feature is off, without needing to touch the SPA at all.
class RejectDisabledApiTokens
{
    public function handle(Request $request, Closure $next): Response
    {
        if (! config('features.api_tokens') && $request->user()?->currentAccessToken() instanceof PersonalAccessToken) {
            abort(401, 'API tokens are currently disabled.');
        }

        return $next($request);
    }
}
