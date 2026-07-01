<?php

namespace App\Services\CloudStorage;

use Illuminate\Validation\ValidationException;

class RemoteUploadUrlGuard
{
    public function validate(string $url, string $field = 'url'): void
    {
        $parts = parse_url($url);
        $scheme = strtolower((string) ($parts['scheme'] ?? ''));
        $host = (string) ($parts['host'] ?? '');

        if (! in_array($scheme, ['http', 'https'], true) || $host === '') {
            throw ValidationException::withMessages([
                $field => 'Remote upload URL must be a valid HTTP or HTTPS URL.',
            ]);
        }

        if (! $this->hostResolvesToPublicAddress($host)) {
            throw ValidationException::withMessages([
                $field => 'Remote upload URL must resolve to a public address.',
            ]);
        }
    }

    private function hostResolvesToPublicAddress(string $host): bool
    {
        if (filter_var($host, FILTER_VALIDATE_IP)) {
            return $this->isPublicIp($host);
        }

        $records = dns_get_record($host, DNS_A + DNS_AAAA);

        if ($records === false || $records === []) {
            $address = gethostbyname($host);

            return $address !== $host && $this->isPublicIp($address);
        }

        foreach ($records as $record) {
            $address = $record['ip'] ?? $record['ipv6'] ?? null;

            if (is_string($address) && ! $this->isPublicIp($address)) {
                return false;
            }
        }

        return true;
    }

    private function isPublicIp(string $address): bool
    {
        return filter_var(
            $address,
            FILTER_VALIDATE_IP,
            FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE,
        ) !== false;
    }
}
