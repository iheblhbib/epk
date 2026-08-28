<?php

namespace App\Providers;

use App\Services\PublicSectionConfigResolver;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Illuminate\Validation\Rules\Password;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        // Singleton so its per-request media_id lookup cache actually holds
        // across every section resolved while rendering one public EPK.
        $this->app->singleton(PublicSectionConfigResolver::class);
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        RateLimiter::for('login', function (Request $request) {
            $throttleKey = strtolower((string) $request->input('email')).'|'.$request->ip();

            return Limit::perMinute(5)->by($throttleKey);
        });

        RateLimiter::for('register', function (Request $request) {
            return Limit::perMinute(5)->by($request->ip());
        });

        // The SPA collects the new password itself, so the reset link points
        // straight at the frontend rather than a (nonexistent) Blade route.
        ResetPassword::createUrlUsing(function ($user, string $token) {
            $frontendUrl = rtrim((string) config('app.frontend_url'), '/');

            return "{$frontendUrl}/reset-password/{$token}?email=".urlencode($user->email);
        });

        // Mirrors the frontend's live requirements checklist — the frontend
        // check is a UX nicety, this is the actual enforcement.
        Password::defaults(fn () => Password::min(8)->mixedCase()->numbers()->symbols());
    }
}
