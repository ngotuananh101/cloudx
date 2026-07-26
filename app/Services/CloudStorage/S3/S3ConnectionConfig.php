<?php

namespace App\Services\CloudStorage\S3;

class S3ConnectionConfig
{
    /**
     * @param  array<string, mixed>  $credentials
     * @return array<string, mixed>
     */
    public function diskOptions(array $credentials): array
    {
        $providerPreset = (string) ($credentials['provider_preset'] ?? 'aws');
        $endpoint = $credentials['endpoint'] ?? $this->defaultEndpointForPreset($providerPreset);
        $usePathStyleEndpoint = array_key_exists('use_path_style_endpoint', $credentials)
            ? (bool) $credentials['use_path_style_endpoint']
            : $this->defaultUsePathStyleEndpointForPreset($providerPreset);

        return array_filter([
            'driver' => 's3',
            'key' => $credentials['access_key_id'] ?? null,
            'secret' => $credentials['secret_access_key'] ?? null,
            'token' => $credentials['session_token'] ?? null,
            'region' => $credentials['region'] ?? 'us-east-1',
            'bucket' => $credentials['bucket'] ?? null,
            'endpoint' => $endpoint,
            'url' => $credentials['cdn_url'] ?? null,
            'root' => $credentials['root'] ?? null,
            'use_path_style_endpoint' => $usePathStyleEndpoint,
            'throw' => true,
            'report' => true,
        ], static fn (mixed $value): bool => $value !== null);
    }

    /**
     * @param  array<string, mixed>  $credentials
     * @return array<string, mixed>
     */
    public function clientOptions(array $credentials): array
    {
        $providerPreset = (string) ($credentials['provider_preset'] ?? 'aws');
        $endpoint = $credentials['endpoint'] ?? $this->defaultEndpointForPreset($providerPreset);
        $usePathStyleEndpoint = array_key_exists('use_path_style_endpoint', $credentials)
            ? (bool) $credentials['use_path_style_endpoint']
            : $this->defaultUsePathStyleEndpointForPreset($providerPreset);

        return array_filter([
            'version' => 'latest',
            'region' => $credentials['region'] ?? 'us-east-1',
            'credentials' => [
                'key' => $credentials['access_key_id'] ?? null,
                'secret' => $credentials['secret_access_key'] ?? null,
                'token' => $credentials['session_token'] ?? null,
            ],
            'endpoint' => $endpoint,
            'use_path_style_endpoint' => $usePathStyleEndpoint,
        ], static fn (mixed $value): bool => $value !== null);
    }

    /**
     * @param  array<string, mixed>  $credentials
     */
    public function objectKey(array $credentials, string $relativeKey): string
    {
        $root = trim((string) ($credentials['root'] ?? ''), '/');
        $key = ltrim($relativeKey, '/');

        if ($root === '') {
            return $key;
        }

        if ($key === '') {
            return $root;
        }

        return $root.'/'.$key;
    }

    public function defaultEndpointForPreset(string $providerPreset): ?string
    {
        return match ($providerPreset) {
            'digitalocean-spaces' => 'https://nyc3.digitaloceanspaces.com',
            'wasabi' => 'https://s3.wasabisys.com',
            'backblaze-b2' => 'https://s3.us-west-004.backblazeb2.com',
            'hetzner' => 'https://fsn1.your-objectstorage.com',
            'cloudflare-r2', 'minio', 'rustfs', 'custom', 'aws' => null,
            default => null,
        };
    }

    public function defaultUsePathStyleEndpointForPreset(string $providerPreset): bool
    {
        return in_array($providerPreset, ['minio', 'cloudflare-r2', 'rustfs'], true);
    }
}
