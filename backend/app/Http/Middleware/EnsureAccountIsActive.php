<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

/**
 * Suspension used to only be checked at login (LoginRequest::authenticate())
 * — which blocks a *new* session but does nothing to one already in
 * progress, so an admin suspending someone mid-session had no actual
 * effect until that session eventually expired on its own. This re-checks
 * on every authenticated request and kills the session the moment it finds
 * one, so suspension takes effect immediately, not "next time they'd have
 * had to log in anyway."
 */
class EnsureAccountIsActive
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user?->suspended_at !== null) {
            Auth::guard('web')->logout();
            $request->session()->invalidate();
            $request->session()->regenerateToken();

            abort(401, __('This account has been suspended. Contact support for help.'));
        }

        return $next($request);
    }
}
