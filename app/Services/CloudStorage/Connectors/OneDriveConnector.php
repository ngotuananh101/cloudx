<?php

namespace App\Services\CloudStorage\Connectors;

use App\Data\CloudStorageQuotaData;
use App\Data\ConnectedAccountData;
use App\Data\ProviderCapabilities;
use App\Enums\CloudProvider;
use App\Models\CloudConnection;
use App\Services\CloudStorage\Contracts\CloudProviderConnector;
use App\Services\CloudStorage\Contracts\ProvidesDirectDownloadLink;
use App\Services\CloudStorage\Contracts\ReportsStorageQuota;
use App\Services\OneDrive\OneDriveClient;
use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use RuntimeException;

class OneDriveConnector implements CloudProviderConnector, ProvidesDirectDownloadLink, ReportsStorageQuota
{
    public const AUTHORIZE_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize';

    public const TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';

    public function provider(): CloudProvider
    {
        return CloudProvider::ONEDRIVE;
    }

    public function redirectUrl(): string
    {
        $state = Str::random(40);

        session()->put($this->stateSessionKey(), $state);

        return self::AUTHORIZE_URL.'?'.http_build_query([
            'client_id' => config('services.microsoft.client_id'),
            'response_type' => 'code',
            'redirect_uri' => config('services.microsoft.redirect_uri'),
            'response_mode' => 'query',
            'scope' => 'User.Read Files.ReadWrite.All offline_access',
            'state' => $state,
        ]);
    }

    public function handleCallback(Request $request): ConnectedAccountData
    {
        $state = $request->query('state');
        $sessionState = $request->session()->pull($this->stateSessionKey());

        if (! is_string($state) || ! is_string($sessionState) || ! hash_equals($sessionState, $state)) {
            throw new RuntimeException('Invalid OneDrive OAuth state.');
        }

        $code = $request->query('code');

        if (! is_string($code) || $code === '') {
            throw new RuntimeException('Microsoft authentication failed or was cancelled.');
        }

        $token = $this->http()->asForm()
            ->retry([100, 250])
            ->post(self::TOKEN_URL, [
                'client_id' => config('services.microsoft.client_id'),
                'client_secret' => config('services.microsoft.client_secret'),
                'code' => $code,
                'redirect_uri' => config('services.microsoft.redirect_uri'),
                'grant_type' => 'authorization_code',
            ])
            ->throw()
            ->json();

        if (! is_array($token) || ! isset($token['access_token']) || ! is_string($token['access_token']) || $token['access_token'] === '') {
            throw new RuntimeException('Microsoft authentication failed or was cancelled.');
        }

        $token['expires_at'] = now()->addSeconds((int) ($token['expires_in'] ?? 3600))->timestamp;

        $user = $this->http()->withToken($token['access_token'])
            ->retry([100, 250])
            ->get('https://graph.microsoft.com/v1.0/me')
            ->throw()
            ->json();

        $drive = $this->http()->withToken($token['access_token'])
            ->retry([100, 250])
            ->get('https://graph.microsoft.com/v1.0/me/drive')
            ->throw()
            ->json();

        $providerId = $user['id'] ?? $user['userPrincipalName'] ?? 'onedrive';
        $email = $user['mail'] ?? $user['userPrincipalName'] ?? $user['displayName'] ?? 'OneDrive';

        return new ConnectedAccountData(
            providerId: (string) $providerId,
            name: "OneDrive ({$email})",
            credentials: $token,
            totalSpace: isset($drive['quota']['total']) ? (int) $drive['quota']['total'] : null,
            usedSpace: isset($drive['quota']['used']) ? (int) $drive['quota']['used'] : null,
        );
    }

    private function stateSessionKey(): string
    {
        return 'oauth_state_onedrive';
    }

    private function http(): PendingRequest
    {
        $request = Http::connectTimeout(5)->timeout(10);

        return app()->isLocal() ? $request->withoutVerifying() : $request;
    }

    public function disk(CloudConnection $connection): Filesystem
    {
        return Storage::build([
            'driver' => 'onedrive',
            'connection' => $connection,
        ]);
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

    public function storageQuota(CloudConnection $connection): CloudStorageQuotaData
    {
        $drive = (new OneDriveClient($connection))->drive();
        $quota = is_array($drive) ? ($drive['quota'] ?? null) : null;

        if (! is_array($quota)) {
            return CloudStorageQuotaData::unsupported();
        }

        $totalBytes = isset($quota['total']) ? (int) $quota['total'] : null;
        $usedBytes = isset($quota['used']) ? (int) $quota['used'] : null;
        $remainingBytes = isset($quota['remaining']) ? (int) $quota['remaining'] : null;

        return new CloudStorageQuotaData(
            totalBytes: $totalBytes,
            usedBytes: $usedBytes,
            remainingBytes: $remainingBytes,
            usedPercent: $totalBytes > 0 && $usedBytes !== null ? round(($usedBytes / $totalBytes) * 100, 1) : null,
        );
    }

    public function directDownloadLink(CloudConnection $connection, string $path): ?string
    {
        $item = (new OneDriveClient($connection))->item($path);

        if (! is_array($item)) {
            return null;
        }

        $url = $item['@microsoft.graph.downloadUrl'] ?? null;

        return is_string($url) && $url !== '' ? $url : null;
    }
}
