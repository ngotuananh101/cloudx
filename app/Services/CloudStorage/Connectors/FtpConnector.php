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

class FtpConnector implements CloudProviderConnector
{
    public function provider(): CloudProvider
    {
        return CloudProvider::FTP;
    }

    public function redirectUrl(): string
    {
        return '';
    }

    public function handleCallback(Request $request): ConnectedAccountData
    {
        throw new LogicException('FTP connections are credential-based and do not support OAuth callbacks.');
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
            'driver' => 'ftp',
            'host' => $credentials['host'] ?? null,
            'username' => $credentials['username'] ?? null,
            'password' => $credentials['password'] ?? null,
            'port' => $credentials['port'] ?? 21,
            'root' => $credentials['root'] ?? '',
            'passive' => $credentials['passive'] ?? true,
            'ssl' => $credentials['ssl'] ?? false,
            'timeout' => $credentials['timeout'] ?? 30,
            'utf8' => $credentials['utf8'] ?? false,
            'ignorePassiveAddress' => $credentials['ignore_passive_address'] ?? null,
            'systemType' => $credentials['system_type'] ?? null,
            'recurseManually' => $credentials['recurse_manually'] ?? true,
            'timestampsOnUnixListingsEnabled' => $credentials['timestamps_on_unix_listings_enabled'] ?? false,
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
