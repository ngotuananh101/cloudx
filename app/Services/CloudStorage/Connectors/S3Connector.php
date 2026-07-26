<?php

namespace App\Services\CloudStorage\Connectors;

use App\Data\ConnectedAccountData;
use App\Data\ProviderCapabilities;
use App\Enums\CloudProvider;
use App\Models\CloudConnection;
use App\Services\CloudStorage\Contracts\CloudProviderConnector;
use App\Services\CloudStorage\Contracts\ProvidesDirectDownloadLink;
use App\Services\CloudStorage\S3\S3ClientFactory;
use App\Services\CloudStorage\S3\S3ConnectionConfig;
use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use LogicException;
use Throwable;

class S3Connector implements CloudProviderConnector, ProvidesDirectDownloadLink
{
    public function __construct(
        private S3ConnectionConfig $connectionConfig,
        private S3ClientFactory $clientFactory,
    ) {}

    public function provider(): CloudProvider
    {
        return CloudProvider::AWS_S3;
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
        return $this->connectionConfig->diskOptions($credentials);
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
            $client = $this->clientFactory->make($connection);
            $cmd = $client->getCommand('GetObject', [
                'Bucket' => $connection->credentials['bucket'],
                'Key' => $this->connectionConfig->objectKey($connection->credentials, $path),
            ]);

            $request = $client->createPresignedRequest($cmd, '+6 hours');

            return (string) $request->getUri();
        } catch (Throwable $e) {
            report($e);

            return null;
        }
    }
}
