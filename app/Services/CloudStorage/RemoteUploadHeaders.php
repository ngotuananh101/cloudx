<?php

namespace App\Services\CloudStorage;

use Illuminate\Validation\ValidationException;

class RemoteUploadHeaders
{
    /**
     * @param  array<int, array{name?: string|null, value?: string|null}>|null  $headers
     * @return array<string, string>
     */
    public function normalize(?array $headers): array
    {
        if ($headers === null) {
            return [];
        }

        $maxHeaders = (int) config('cloud-storage.remote_upload.max_headers', 10);

        if (count($headers) > $maxHeaders) {
            throw ValidationException::withMessages([
                'headers' => "Remote upload accepts at most {$maxHeaders} custom headers.",
            ]);
        }

        $normalizedHeaders = [];

        foreach ($headers as $index => $header) {
            $entry = $this->normalizeHeader($header, $index);

            if ($entry === null) {
                continue;
            }

            $normalizedHeaders[$entry['name']] = $entry['value'];
        }

        return $normalizedHeaders;
    }

    /**
     * @param  array{name?: string|null, value?: string|null}  $header
     * @return array{name: string, value: string}|null
     */
    private function normalizeHeader(array $header, int $index): ?array
    {
        $name = trim((string) ($header['name'] ?? ''));
        $value = trim((string) ($header['value'] ?? ''));

        if ($name === '' && $value === '') {
            return null;
        }

        $this->assertValidHeaderName($name, $index);
        $this->assertValidHeaderValue($value, $index);

        return ['name' => $name, 'value' => $value];
    }

    private function assertValidHeaderName(string $name, int $index): void
    {
        if ($name === '' || ! preg_match('/^[A-Za-z0-9!#$%&\'*+.^_`|~-]+$/', $name)) {
            throw ValidationException::withMessages([
                "headers.{$index}.name" => 'Header name is invalid.',
            ]);
        }

        if ($this->isBlockedHeader($name)) {
            throw ValidationException::withMessages([
                "headers.{$index}.name" => 'This header cannot be customized.',
            ]);
        }

        if (mb_strlen($name) > (int) config('cloud-storage.remote_upload.max_header_name_length', 64)) {
            throw ValidationException::withMessages([
                "headers.{$index}.name" => 'Header name is too long.',
            ]);
        }
    }

    private function assertValidHeaderValue(string $value, int $index): void
    {
        if (mb_strlen($value) > (int) config('cloud-storage.remote_upload.max_header_value_length', 1024)) {
            throw ValidationException::withMessages([
                "headers.{$index}.value" => 'Header value is too long.',
            ]);
        }

        if (str_contains($value, "\r") || str_contains($value, "\n")) {
            throw ValidationException::withMessages([
                "headers.{$index}.value" => 'Header value is invalid.',
            ]);
        }
    }

    private function isBlockedHeader(string $name): bool
    {
        return in_array(strtolower($name), [
            'connection',
            'content-length',
            'expect',
            'host',
            'proxy-authorization',
            'te',
            'trailer',
            'transfer-encoding',
            'upgrade',
        ], true);
    }
}
