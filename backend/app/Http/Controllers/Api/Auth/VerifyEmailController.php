<?php

namespace App\Http\Controllers\Api\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Auth\Events\Verified;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Redirect;

class VerifyEmailController extends Controller
{
    /**
     * Signed links land here from an email client — a real page navigation
     * with no active SPA session (Sanctum's Referer-based "is this from our
     * frontend" check never matches a top-level navigation opened from
     * email, and the click may not even happen in the same browser the user
     * registered in). So identity here comes entirely from the signed URL
     * (id + a hash of the email) rather than the authenticated session; the
     * "signed" route middleware already rejects a missing/expired/tampered
     * signature before this method runs.
     */
    public function __invoke(int $id, string $hash): RedirectResponse
    {
        $user = User::findOrFail($id);
        $frontendUrl = rtrim((string) config('app.frontend_url'), '/');

        if (! hash_equals(sha1($user->getEmailForVerification()), $hash)) {
            return Redirect::away("{$frontendUrl}/login?verified=0");
        }

        if (! $user->hasVerifiedEmail()) {
            $user->markEmailAsVerified();

            event(new Verified($user));
        }

        return Redirect::away("{$frontendUrl}/login?verified=1");
    }
}
