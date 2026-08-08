<?php

namespace App\Services\CloudStorage;

use Illuminate\Validation\ValidationException;

class HostAddressGuard
{
    public function hostIsAllowed(string $host): bool
    {
        return $this->resolveAllowedIp($host) !== null;
    }

    public function resolveAllowedIp(string $host): ?string
    {
        if ($host === '') {
            return null;
        }

        if (filter_var($host, FILTER_VALIDATE_IP)) {
            return $this->isPublicIp($host) ? $host : null;
        }

        $records = dns_get_record($host, DNS_A + DNS_AAAA);

        if ($records === false || $records === []) {
            $address = gethostbyname($host);

            return $address !== $host && $this->isPublicIp($address) ? $address : null;
        }

        foreach ($records as $record) {
            $address = $record['ip'] ?? $record['ipv6'] ?? null;

            if (is_string($address) && $this->isPublicIp($address)) {
                return $address;
            }
        }

        return null;
    }

    public function hostIsAllowedForConnections(string $host): bool
    {
        $normalizedHost = strtolower(trim($host));
        $allowed = config('cloud-storage.host_policy.allowed_private_hosts', []);

        if (is_array($allowed)) {
            foreach ($allowed as $entry) {
                if (is_string($entry) && strtolower(trim($entry)) === $normalizedHost) {
                    return true;
                }
            }
        }

        if ((bool) config('cloud-storage.host_policy.allow_private_connection_hosts', false)) {
            return true;
        }

        return $this->hostIsAllowed($host);
    }

    public function assertConnectionHostAllowed(string $host, string $field = 'host'): void
    {
        if ($this->hostIsAllowedForConnections($host)) {
            return;
        }

        throw ValidationException::withMessages([
            $field => 'Connection host must resolve to a public address or be explicitly allowlisted.',
        ]);
    }

    private function isPublicIp(string $address): bool
    {
        if ($this->isBlockedSpecialRange($address)) {
            return false;
        }

        return filter_var(
            $address,
            FILTER_VALIDATE_IP,
            FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE,
        ) !== false;
    }

    private function isBlockedSpecialRange(string $address): bool
    {
        // CGNAT 100.64.0.0/10 — not covered by FILTER_FLAG_NO_PRIV_RANGE.
        if (filter_var($address, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4)) {
            $long = ip2long($address);

            if ($long !== false) {
                $cgnatStart = ip2long('100.64.0.0');
                $cgnatEnd = ip2long('100.127.255.255');
                $benchmarkStart = ip2long('198.18.0.0');
                $benchmarkEnd = ip2long('198.19.255.255');

                if ($long >= $cgnatStart && $long <= $cgnatEnd) {
                    return true;
                }

                if ($long >= $benchmarkStart && $long <= $benchmarkEnd) {
                    return true;
                }
            }
        }

        return false;
    }
}
