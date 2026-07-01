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
            $name = trim((string) ($header['name'] ?? ''));
            $value = trim((string) ($header['value'] ?? ''));

            if ($name === '' && $value === '') {
                continue;
            }

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

            $normalizedHeaders[$name] = $value;
        }

        return $normalizedHeaders;
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
