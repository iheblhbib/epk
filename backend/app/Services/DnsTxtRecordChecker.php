<?php

namespace App\Services;

/**
 * Thin wrapper around dns_get_record() so DNS ownership checks (see
 * EpkCustomDomainController::verify()) can be faked in tests instead of
 * depending on a real DNS lookup actually succeeding in CI.
 */
class DnsTxtRecordChecker
{
    public function matches(string $host, string $expectedValue): bool
    {
        // Suppressed: a lookup for a host with no such record (the common
        // case, before the owner has added it yet) raises a PHP warning
        // here, not just an empty result.
        $records = @dns_get_record($host, DNS_TXT) ?: [];

        foreach ($records as $record) {
            if (($record['txt'] ?? null) === $expectedValue) {
                return true;
            }
        }

        return false;
    }
}
