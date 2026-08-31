<?php

use App\Http\Middleware\AddSecurityHeaders;
use App\Http\Middleware\EnsureAccountIsActive;
use App\Http\Middleware\EnsureUserIsAdmin;
use App\Http\Middleware\RejectDisabledApiTokens;
use App\Http\Middleware\SetLocaleFromUser;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->statefulApi();
        $middleware->alias([
            'admin' => EnsureUserIsAdmin::class,
            'active' => EnsureAccountIsActive::class,
            'tokens-enabled' => RejectDisabledApiTokens::class,
        ]);
        // Global (every request, not just authenticated ones) — the guest
        // fallback covers login/register/public-EPK-page messages too. Runs
        // fine without the `auth:sanctum` route middleware: statefulApi()
        // above already establishes the session-based auth guard, and
        // $request->user() just reads from that guard directly.
        $middleware->append(SetLocaleFromUser::class);
        $middleware->append(AddSecurityHeaders::class);

        // This app has no server-rendered login page — it's a pure JSON API
        // behind a separate SPA (see docs/architecture.md). Laravel's own
        // default here is redirectGuestsTo(fn () => route('login')): a
        // *named* route this app never defines. Left alone, an unauthenticated
        // request that Laravel doesn't think "expects JSON" (a plain browser
        // navigation, e.g. clicking a PDF download <a href> with an expired
        // session — curl with no Accept header hits the same path) crashes
        // with a raw 500 RouteNotFoundException while Laravel's own
        // AuthenticationException is still being *constructed* — before it's
        // even thrown, so nothing downstream (including a custom exception
        // renderer) ever gets a chance to turn it into a clean response.
        // Returning null here is what actually prevents that crash.
        $middleware->redirectGuestsTo(fn () => null);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        // Belt-and-suspenders alongside redirectGuestsTo() above: this makes
        // Laravel's unauthenticated()/renderExceptionResponse() treat every
        // request as JSON-expecting, so a 401/403/404/500 always comes back
        // as JSON — including a request that (unlike normal SPA fetch calls)
        // doesn't happen to send an Accept: application/json header, the
        // same category of request that triggered the crash above.
        $exceptions->shouldRenderJsonWhen(fn () => true);
    })->create();
