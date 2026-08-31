<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreEpkCustomDomainRequest;
use App\Models\Epk;
use App\Services\DnsTxtRecordChecker;
use App\Services\PlanLimits;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * The app's half of custom domains — claiming a domain, proving ownership
 * of it via a DNS TXT record, and (once verified) letting
 * PublicEpkController::showByDomain() resolve it. Making the domain
 * actually reachable — its CNAME, and an SSL certificate for it — is
 * infrastructure work outside this codebase; see docs/custom-domains.md
 * for the manual host-side steps this instructs the owner through.
 */
class EpkCustomDomainController extends Controller
{
    /**
     * Read-only fetch of the current setup instructions — used to
     * re-display the DNS records to add/check on a domain that's already
     * been claimed, without generating a new verification token the way
     * store() does (which would invalidate a TXT record the owner may have
     * already correctly published).
     */
    public function show(Epk $epk): JsonResponse
    {
        $this->authorize('view', $epk);

        return response()->json(['data' => $epk->custom_domain ? $this->setupInstructions($epk) : null]);
    }

    public function store(StoreEpkCustomDomainRequest $request, Epk $epk, PlanLimits $planLimits): JsonResponse
    {
        if (! $planLimits->canUseCustomDomains($epk->workspace)) {
            throw ValidationException::withMessages([
                'domain' => __('Custom domains require the Business plan.'),
            ]);
        }

        // A fresh token every time the domain is (re)claimed — an old proof
        // must never verify a newly-set domain, and re-adding the very same
        // domain after removing it starts verification over too.
        $epk->update([
            'custom_domain' => strtolower($request->validated('domain')),
            'custom_domain_token' => Str::random(32),
            'custom_domain_verified_at' => null,
        ]);

        return response()->json(['data' => $this->setupInstructions($epk)]);
    }

    public function verify(Epk $epk, DnsTxtRecordChecker $dns): JsonResponse
    {
        $this->authorize('update', $epk);

        if (! $epk->custom_domain || ! $epk->custom_domain_token) {
            throw ValidationException::withMessages([
                'domain' => __('Set up a custom domain first.'),
            ]);
        }

        if (! $dns->matches("_kitfolio-challenge.{$epk->custom_domain}", $epk->custom_domain_token)) {
            throw ValidationException::withMessages([
                'domain' => __('The verification record was not found yet. DNS changes can take a while to propagate — please try again shortly.'),
            ]);
        }

        $epk->update(['custom_domain_verified_at' => now()]);

        return response()->json(['data' => $this->setupInstructions($epk)]);
    }

    public function destroy(Epk $epk): JsonResponse
    {
        $this->authorize('update', $epk);

        $epk->update([
            'custom_domain' => null,
            'custom_domain_token' => null,
            'custom_domain_verified_at' => null,
        ]);

        return response()->json(['message' => __('Custom domain removed.')]);
    }

    /**
     * @return array<string, mixed>
     */
    private function setupInstructions(Epk $epk): array
    {
        return [
            'domain' => $epk->custom_domain,
            'verified' => $epk->hasVerifiedCustomDomain(),
            'verification_record' => [
                'type' => 'TXT',
                'host' => "_kitfolio-challenge.{$epk->custom_domain}",
                'value' => $epk->custom_domain_token,
            ],
            'routing_record' => [
                'type' => 'CNAME',
                'host' => $epk->custom_domain,
                'value' => parse_url((string) config('app.frontend_url'), PHP_URL_HOST),
            ],
        ];
    }
}
