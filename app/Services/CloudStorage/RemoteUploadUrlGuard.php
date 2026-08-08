<?php

namespace App\Services\CloudStorage;

use Illuminate\Validation\ValidationException;

class RemoteUploadUrlGuard
{
    public function __construct(private HostAddressGuard $hostAddressGuard) {}

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

        if (! $this->hostAddressGuard->hostIsAllowed($host)) {
            throw ValidationException::withMessages([
                $field => 'Remote upload URL must resolve to a public address.',
            ]);
        }
    }

    public function resolveIpForUrl(string $url, string $field = 'url'): string
    {
        $parts = parse_url($url);
        $scheme = strtolower((string) ($parts['scheme'] ?? ''));
        $host = (string) ($parts['host'] ?? '');

        if (! in_array($scheme, ['http', 'https'], true) || $host === '') {
            throw ValidationException::withMessages([
                $field => 'Remote upload URL must be a valid HTTP or HTTPS URL.',
            ]);
        }

        $ip = $this->hostAddressGuard->resolveAllowedIp($host);

        if ($ip === null) {
            throw ValidationException::withMessages([
                $field => 'Remote upload URL must resolve to a public address.',
            ]);
        }

        return $ip;
    }

    public function substituteHostWithIp(string $url, string $ip): string
    {
        $parts = parse_url($url);
        $scheme = (string) ($parts['scheme'] ?? 'https');
        $port = isset($parts['port']) ? ':'.$parts['port'] : '';
        $path = (string) ($parts['path'] ?? '');
        $query = isset($parts['query']) ? '?'.$parts['query'] : '';
        $fragment = isset($parts['fragment']) ? '#'.$parts['fragment'] : '';

        return $scheme.'://'.$ip.$port.$path.$query.$fragment;
    }
}
