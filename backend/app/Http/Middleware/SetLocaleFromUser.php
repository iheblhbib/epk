<?php

namespace App\Http\Middleware;

use App\Enums\Locale;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Every response-shaping __() call in the app — validation errors,
 * suspension messages, "you've reached your plan limit", etc. — goes
 * through this. A signed-in user's saved preference wins; a guest (login,
 * register, forgot-password, the public/private EPK pages) gets whatever
 * the frontend's current UI language sends via Accept-Language, so a French
 * speaker filling in the login form still sees French validation errors
 * before they've ever had an account to save a preference on.
 */
class SetLocaleFromUser
{
    public function handle(Request $request, Closure $next): Response
    {
        $locale = $request->user()?->locale?->value
            ?? $this->preferredFromHeader($request)
            ?? config('app.locale');

        app()->setLocale($locale);

        return $next($request);
    }

    private function preferredFromHeader(Request $request): ?string
    {
        $preferred = $request->getPreferredLanguage(array_map(fn (Locale $l) => $l->value, Locale::cases()));

        return $preferred;
    }
}
