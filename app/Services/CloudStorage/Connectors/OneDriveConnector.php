<?php

namespace App\Services\CloudStorage\Connectors;

use App\Data\ConnectedAccountData;
use App\Data\ProviderCapabilities;
use App\Enums\CloudProvider;
use App\Models\CloudConnection;
use App\Services\CloudStorage\Contracts\BrowsesCloudFiles;
use App\Services\CloudStorage\Contracts\CloudProviderConnector;
use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use RuntimeException;

class OneDriveConnector implements BrowsesCloudFiles, CloudProviderConnector
{
    public const AUTHORIZE_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize';

    public const TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';

    public function provider(): CloudProvider
    {
        return CloudProvider::ONEDRIVE();
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

        $token = Http::asForm()
            ->connectTimeout(5)
            ->timeout(10)
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

        $user = Http::withToken($token['access_token'])
            ->connectTimeout(5)
            ->timeout(10)
            ->retry([100, 250])
            ->get('https://graph.microsoft.com/v1.0/me')
            ->throw()
            ->json();

        $drive = Http::withToken($token['access_token'])
            ->connectTimeout(5)
            ->timeout(10)
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

    /**
     * @return array<string, mixed>
     */
    public function credentialsForGraph(CloudConnection $connection): array
    {
        $credentials = $connection->credentials ?? [];
        $expiresAt = (int) ($credentials['expires_at'] ?? 0);

        if ($expiresAt > now()->addMinutes(5)->timestamp) {
            return $credentials;
        }

        $refreshToken = $credentials['refresh_token'] ?? null;

        if (! is_string($refreshToken) || $refreshToken === '') {
            throw new RuntimeException('OneDrive refresh token is missing.');
        }

        $token = Http::asForm()
            ->connectTimeout(5)
            ->timeout(10)
            ->retry([100, 250])
            ->post(self::TOKEN_URL, [
                'client_id' => config('services.microsoft.client_id'),
                'client_secret' => config('services.microsoft.client_secret'),
                'refresh_token' => $refreshToken,
                'grant_type' => 'refresh_token',
            ])
            ->throw()
            ->json();

        if (! is_array($token) || ! isset($token['access_token']) || ! is_string($token['access_token']) || $token['access_token'] === '') {
            return $credentials;
        }

        $credentials = array_merge($credentials, $token, [
            'refresh_token' => $token['refresh_token'] ?? $credentials['refresh_token'] ?? null,
            'expires_at' => now()->addSeconds((int) ($token['expires_in'] ?? 3600))->timestamp,
        ]);

        $connection->forceFill(['credentials' => $credentials])->save();

        return $credentials;
    }

    /**
     * Return normalized OneDrive items with id, path, name, isDirectory, size, lastModifiedTimestamp.
     *
     * @return array<int, array{id: string, path: string, name: string, isDirectory: bool, size: int, lastModifiedTimestamp: int|null}>
     */
    public function listContents(CloudConnection $connection, string $path): array
    {
        $credentials = $this->credentialsForGraph($connection);
        $normalizedPath = trim($path, '/');
        $url = 'https://graph.microsoft.com/v1.0/me/drive/root/children';

        if ($normalizedPath !== '') {
            $encodedPath = collect(explode('/', $normalizedPath))
                ->map(fn (string $segment): string => rawurlencode($segment))
                ->implode('/');
            $url = "https://graph.microsoft.com/v1.0/me/drive/root:/{$encodedPath}:/children";
        }

        $response = Http::withToken((string) ($credentials['access_token'] ?? ''))
            ->connectTimeout(5)
            ->timeout(10)
            ->retry([100, 250])
            ->get($url)
            ->throw()
            ->json();

        $items = is_array($response) && isset($response['value']) && is_array($response['value']) ? $response['value'] : [];

        return collect($items)
            ->map(function (array $item) use ($normalizedPath): array {
                $name = (string) ($item['name'] ?? '');
                $isDirectory = isset($item['folder']);
                $itemPath = $normalizedPath === '' ? $name : $normalizedPath.'/'.$name;
                $lastModified = $item['lastModifiedDateTime'] ?? null;

                return [
                    'id' => (string) ($item['id'] ?? ''),
                    'path' => $itemPath,
                    'name' => $name,
                    'isDirectory' => $isDirectory,
                    'size' => $isDirectory ? 0 : (int) ($item['size'] ?? 0),
                    'lastModifiedTimestamp' => is_string($lastModified) ? strtotime($lastModified) ?: null : null,
                ];
            })
            ->all();
    }

    public function disk(CloudConnection $connection): Filesystem
    {
        throw new RuntimeException('OneDrive disk is not implemented yet.');
    }

    public function capabilities(): ProviderCapabilities
    {
        return new ProviderCapabilities(
            browse: true,
            upload: true,
            download: true,
            delete: true,
            createFolder: true,
            share: false,
        );
    }
}
