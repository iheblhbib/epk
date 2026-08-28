<?php

namespace App\Services;

use App\Enums\AnalyticsEventType;
use App\Enums\DeviceType;
use App\Models\AnalyticsEvent;
use App\Models\Epk;
use App\Models\PrivateLink;
use DeviceDetector\DeviceDetector;
use Illuminate\Http\Request;

/**
 * Turns one public-page interaction into an AnalyticsEvent row — hashing the
 * visitor's IP rather than storing it, and reading device/browser/OS from
 * the user agent via matomo/device-detector (a local, offline parser; no
 * external service is ever called for this).
 */
class AnalyticsEventLogger
{
    public function log(
        Request $request,
        Epk $epk,
        AnalyticsEventType $type,
        array $meta = [],
        ?PrivateLink $privateLink = null
    ): AnalyticsEvent {
        $userAgent = (string) $request->userAgent();
        $detector = new DeviceDetector($userAgent);
        $detector->parse();

        return AnalyticsEvent::create([
            'epk_id' => $epk->id,
            'private_link_id' => $privateLink?->id,
            'type' => $type,
            'visitor_hash' => $this->visitorHash($request->ip() ?? '', $userAgent),
            'referrer_host' => $this->refererHost($request->header('Referer')),
            'country' => $this->countryFromHeaders($request),
            'device_type' => $this->deviceType($detector),
            'browser' => $detector->getClient('name') ?: null,
            'os' => $detector->getOs('name') ?: null,
            'meta' => $meta ?: null,
        ]);
    }

    /**
     * HMAC rather than a plain hash so the visitor_hash can't be reversed
     * or rainbow-tabled without the app key — and it's never the raw IP.
     * Deliberately not date-rotated: the same visitor keeps the same hash
     * across days, so COUNT(DISTINCT visitor_hash) over a date range is a
     * genuine unique-visitor count, not one inflated by day-boundaries.
     */
    private function visitorHash(string $ip, string $userAgent): string
    {
        return hash_hmac('sha256', "{$ip}|{$userAgent}", config('app.key'));
    }

    private function refererHost(?string $referer): ?string
    {
        if (! $referer) {
            return null;
        }

        $host = parse_url($referer, PHP_URL_HOST);

        return $host ? strtolower((string) preg_replace('/^www\./', '', $host)) : null;
    }

    /**
     * Zero-external-call country detection: reads whatever the hosting
     * environment already provides — Apache's mod_geoip2 (common on cPanel/
     * shared hosting) sets GEOIP_COUNTRY_CODE; a CDN/proxy like Cloudflare
     * sets CF-IPCountry. Neither requires this app to bundle a GeoIP
     * database or make an outbound lookup per visitor. Null if neither
     * header is present — country simply isn't reported, not guessed.
     */
    private function countryFromHeaders(Request $request): ?string
    {
        $code = $request->server('GEOIP_COUNTRY_CODE') ?: $request->header('CF-IPCountry');

        if (! $code || ! is_string($code) || strtolower($code) === 'xx') {
            return null;
        }

        return strtoupper(substr($code, 0, 2));
    }

    private function deviceType(DeviceDetector $detector): DeviceType
    {
        return match (true) {
            $detector->isSmartphone() => DeviceType::Mobile,
            $detector->isTablet() => DeviceType::Tablet,
            $detector->isDesktop() => DeviceType::Desktop,
            default => DeviceType::Other,
        };
    }
}
