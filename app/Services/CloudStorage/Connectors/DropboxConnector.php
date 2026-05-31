<?php

namespace App\Services\CloudStorage\Connectors;

use App\Data\ConnectedAccountData;
use App\Data\ProviderCapabilities;
use App\Enums\CloudProvider;
use App\Models\CloudConnection;
use App\Services\CloudStorage\Contracts\CloudProviderConnector;
use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use RuntimeException;

class DropboxConnector implements CloudProviderConnector
{
    public const AUTHORIZE_URL = 'https://www.dropbox.com/oauth2/authorize';

    public const TOKEN_URL = 'https://api.dropboxapi.com/oauth2/token';

    public const CURRENT_ACCOUNT_URL = 'https://api.dropboxapi.com/2/users/get_current_account';

    public const SPACE_USAGE_URL = 'https://api.dropboxapi.com/2/users/get_space_usage';

    public function provider(): CloudProvider
    {
        return CloudProvider::DROPBOX();
    }

    public function redirectUrl(): string
    {
        $state = Str::random(40);

        session()->put($this->stateSessionKey(), $state);

        return self::AUTHORIZE_URL.'?'.http_build_query([
            'client_id' => config('services.dropbox.client_id'),
            'response_type' => 'code',
            'redirect_uri' => config('services.dropbox.redirect_uri'),
            'token_access_type' => 'offline',
            'scope' => 'account_info.read files.metadata.read files.content.read files.content.write',
            'state' => $state,
        ]);
    }

    public function handleCallback(Request $request): ConnectedAccountData
    {
        $state = $request->query('state');
        $sessionState = $request->session()->pull($this->stateSessionKey());

        if (! is_string($state) || ! is_string($sessionState) || ! hash_equals($sessionState, $state)) {
            throw new RuntimeException('Invalid Dropbox OAuth state.');
        }

        $code = $request->query('code');

        if (! is_string($code) || $code === '') {
            throw new RuntimeException('Dropbox authentication failed or was cancelled.');
        }

        $token = $this->tokenFromAuthorizationCode($code);
        $accessToken = (string) $token['access_token'];

        $account = $this->http()->withToken($accessToken)
            ->withBody('null', 'application/json')
            ->retry([100, 250])
            ->post(self::CURRENT_ACCOUNT_URL)
            ->throw()
            ->json();

        $spaceUsage = $this->http()->withToken($accessToken)
            ->withBody('null', 'application/json')
            ->retry([100, 250])
            ->post(self::SPACE_USAGE_URL)
            ->throw()
            ->json();

        $providerId = (string) ($account['account_id'] ?? $token['account_id'] ?? 'dropbox');
        $email = (string) ($account['email'] ?? data_get($account, 'name.display_name', 'Dropbox'));
        $allocation = is_array($spaceUsage) ? ($spaceUsage['allocation'] ?? null) : null;
        $totalSpace = is_array($allocation) && isset($allocation['allocated']) ? (int) $allocation['allocated'] : null;
        $usedSpace = is_array($spaceUsage) && isset($spaceUsage['used']) ? (int) $spaceUsage['used'] : null;

        return new ConnectedAccountData(
            providerId: $providerId,
            name: "Dropbox ({$email})",
            credentials: $token,
            totalSpace: $totalSpace,
            usedSpace: $usedSpace,
        );
    }

    public function disk(CloudConnection $connection): Filesystem
    {
        $credentials = $this->freshCredentials($connection);

        return Storage::build([
            'driver' => 'dropbox',
            'authorization_token' => (string) $credentials['access_token'],
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
            share: false,
        );
    }

    private function stateSessionKey(): string
    {
        return 'oauth_state_dropbox';
    }

    private function http(): PendingRequest
    {
        $request = Http::connectTimeout(5)->timeout(10);

        return app()->isLocal() ? $request->withoutVerifying() : $request;
    }

    /**
     * @return array<string, mixed>
     */
    private function tokenFromAuthorizationCode(string $code): array
    {
        $token = $this->http()->asForm()
            ->retry([100, 250])
            ->post(self::TOKEN_URL, [
                'client_id' => config('services.dropbox.client_id'),
                'client_secret' => config('services.dropbox.client_secret'),
                'code' => $code,
                'redirect_uri' => config('services.dropbox.redirect_uri'),
                'grant_type' => 'authorization_code',
            ])
            ->throw()
            ->json();

        if (! is_array($token) || ! isset($token['access_token']) || ! is_string($token['access_token']) || $token['access_token'] === '') {
            throw new RuntimeException('Dropbox authentication failed or was cancelled.');
        }

        $token['expires_at'] = now()->addSeconds((int) ($token['expires_in'] ?? 14400))->timestamp;

        return $token;
    }

    /**
     * @return array<string, mixed>
     */
    private function freshCredentials(CloudConnection $connection): array
    {
        $credentials = $connection->credentials;
        $expiresAt = (int) ($credentials['expires_at'] ?? 0);

        if ($expiresAt > now()->addMinute()->timestamp) {
            return $credentials;
        }

        $refreshToken = $credentials['refresh_token'] ?? null;

        if (! is_string($refreshToken) || $refreshToken === '') {
            return $credentials;
        }

        $token = $this->http()->asForm()
            ->retry([100, 250])
            ->post(self::TOKEN_URL, [
                'client_id' => config('services.dropbox.client_id'),
                'client_secret' => config('services.dropbox.client_secret'),
                'refresh_token' => $refreshToken,
                'grant_type' => 'refresh_token',
            ])
            ->throw()
            ->json();

        if (! is_array($token) || ! isset($token['access_token']) || ! is_string($token['access_token']) || $token['access_token'] === '') {
            return $credentials;
        }

        $freshCredentials = array_merge($credentials, $token, [
            'refresh_token' => $refreshToken,
            'expires_at' => now()->addSeconds((int) ($token['expires_in'] ?? 14400))->timestamp,
        ]);

        $connection->forceFill([
            'credentials' => $freshCredentials,
            'last_synced_at' => now(),
        ])->save();

        return $freshCredentials;
    }
}
