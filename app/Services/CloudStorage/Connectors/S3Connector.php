<?php

namespace App\Services\CloudStorage\Connectors;

use App\Data\ConnectedAccountData;
use App\Data\ProviderCapabilities;
use App\Enums\CloudProvider;
use App\Models\CloudConnection;
use App\Services\CloudStorage\Contracts\CloudProviderConnector;
use App\Services\CloudStorage\Contracts\ProvidesDirectDownloadLink;
use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use LogicException;
use Throwable;

class S3Connector implements CloudProviderConnector, ProvidesDirectDownloadLink
{
    public function provider(): CloudProvider
    {
        return CloudProvider::AWS_S3();
    }

    public function redirectUrl(): string
    {
        return '';
    }

    public function handleCallback(Request $request): ConnectedAccountData
    {
        throw new LogicException('AWS S3 connections are credential-based and do not support OAuth callbacks.');
    }

    public function disk(CloudConnection $connection): Filesystem
    {
        return $this->diskFromCredentials($connection->credentials);
    }

    /**
     * @param  array<string, mixed>  $credentials
     */
    public function diskFromCredentials(array $credentials): Filesystem
    {
        return Storage::build($this->diskConfig($credentials));
    }

    /**
     * @param  array<string, mixed>  $credentials
     * @return array<string, mixed>
     */
    public function diskConfig(array $credentials): array
    {
        $providerPreset = $credentials['provider_preset'] ?? 'aws';
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
            'throw' => false,
            'report' => false,
        ], static fn (mixed $value): bool => $value !== null);
    }

    public function capabilities(): ProviderCapabilities
    {
        return new ProviderCapabilities(
            browse: true,
            upload: true,
            download: true,
            delete: true,
            createFolder: true,
            share: true,
            move: true,
        );
    }

    public function directDownloadLink(CloudConnection $connection, string $path): ?string
    {
        try {
            $client = new \Aws\S3\S3Client($this->s3ClientConfig($connection->credentials));
            $cmd = $client->getCommand('GetObject', [
                'Bucket' => $connection->credentials['bucket'],
                'Key' => ltrim($path, '/'),
            ]);

            $request = $client->createPresignedRequest($cmd, '+6 hours');

            return (string) $request->getUri();
        } catch (Throwable $e) {
            report($e);
            return null;
        }
    }

    /**
     * @param  array<string, mixed>  $credentials
     * @return array<string, mixed>
     */
    private function s3ClientConfig(array $credentials): array
    {
        $providerPreset = $credentials['provider_preset'] ?? 'aws';
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

    private function defaultEndpointForPreset(string $providerPreset): ?string
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

    private function defaultUsePathStyleEndpointForPreset(string $providerPreset): bool
    {
        return in_array($providerPreset, ['minio', 'cloudflare-r2', 'rustfs'], true);
    }
}
