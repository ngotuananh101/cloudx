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
}
