<?php

namespace App\Services\CloudStorage\Connectors;

use App\Data\ConnectedAccountData;
use App\Data\ProviderCapabilities;
use App\Enums\CloudProvider;
use App\Models\CloudConnection;
use App\Services\CloudStorage\Contracts\CloudProviderConnector;
use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use LogicException;

class SftpConnector implements CloudProviderConnector
{
    public function provider(): CloudProvider
    {
        return CloudProvider::SFTP();
    }

    public function redirectUrl(): string
    {
        return '';
    }

    public function handleCallback(Request $request): ConnectedAccountData
    {
        throw new LogicException('SFTP connections are credential-based and do not support OAuth callbacks.');
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
        return array_filter([
            'driver' => 'sftp',
            'host' => $credentials['host'] ?? null,
            'username' => $credentials['username'] ?? null,
            'password' => $credentials['password'] ?? null,
            'privateKey' => $credentials['privateKey'] ?? null,
            'passphrase' => $credentials['passphrase'] ?? null,
            'port' => (int) ($credentials['port'] ?? 22),
            'root' => empty($credentials['root']) ? '/' : $credentials['root'],
            'timeout' => (int) ($credentials['timeout'] ?? 30),
            'useAgent' => (bool) ($credentials['useAgent'] ?? false),
            'hostFingerprint' => $credentials['hostFingerprint'] ?? null,
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
}
