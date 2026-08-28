<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * A handful of response headers that cost nothing and close off a few
 * standard attack classes — this is an API, so none of these constrain any
 * real feature. (HSTS is deliberately left out: it belongs at the web
 * server/TLS-termination layer set up in the cPanel deployment phase, not
 * hardcoded here where a local `php artisan serve` over plain HTTP would
 * otherwise ship it too.)
 */
class AddSecurityHeaders
{
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        $response->headers->set('X-Content-Type-Options', 'nosniff');
        $response->headers->set('X-Frame-Options', 'DENY');
        $response->headers->set('Referrer-Policy', 'strict-origin-when-cross-origin');

        return $response;
    }
}
