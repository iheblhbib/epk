<?php

namespace App\Support;

use Illuminate\Http\Request;

/**
 * Pulls a "where did this request come from" pair — IP and a best-effort
 * ISO country code — out of an HTTP request, for the "was this you?" line
 * in security-alert emails. Country detection is zero-external-call: it
 * reads whatever the host/CDN already put in the headers (Cloudflare's
 * CF-IPCountry, a GeoIP server var), and is simply absent otherwise.
 */
class RequestOrigin
{
    /**
     * @return array{0: string|null, 1: string|null} [ip, country]
     */
    public static function of(Request $request): array
    {
        $code = $request->server('GEOIP_COUNTRY_CODE') ?: $request->header('CF-IPCountry');
        $country = is_string($code) && strtolower($code) !== 'xx'
            ? strtoupper(substr($code, 0, 2))
            : null;

        return [$request->ip(), $country];
    }
}
