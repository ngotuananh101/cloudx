<?php

namespace App\Services\CloudStorage\Connectors;

use App\Data\ConnectedAccountData;
use App\Data\ProviderCapabilities;
use App\Enums\CloudProvider;
use App\Models\CloudConnection;
use App\Services\CloudStorage\Contracts\CloudProviderConnector;
use Google\Client;
use Google\Service\Drive;
use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use RuntimeException;

class GoogleDriveConnector implements CloudProviderConnector
{
    public function provider(): CloudProvider
    {
        return CloudProvider::GOOGLE_DRIVE;
    }

    public function redirectUrl(): string
    {
        $client = $this->client();
        $this->configureClient($client);
        $client->addScope(Drive::DRIVE);
        $client->setAccessType('offline');
        $client->setPrompt('consent');

        return $client->createAuthUrl();
    }

    public function handleCallback(Request $request): ConnectedAccountData
    {
        $code = $request->string('code')->toString();

        if ($code === '') {
            throw new RuntimeException('Google OAuth callback is missing an authorization code.');
        }

        $client = $this->client();
        $this->configureClient($client);

        $token = $client->fetchAccessTokenWithAuthCode($code);

        if (isset($token['error'])) {
            throw new RuntimeException((string) ($token['error_description'] ?? $token['error']));
        }

        $client->setAccessToken($token);

        $drive = new Drive($client);
        $about = $drive->about->get(['fields' => 'user,storageQuota']);
        $user = $about->getUser();
        $quota = $about->getStorageQuota();
        $email = $user?->getEmailAddress();

        if (! is_string($email) || $email === '') {
            throw new RuntimeException('Google Drive account email could not be determined.');
        }

        return new ConnectedAccountData(
            providerId: $email,
            name: "Google Drive ({$email})",
            credentials: $token,
            totalSpace: $quota?->getLimit(),
            usedSpace: $quota?->getUsage(),
        );
    }

    public function disk(CloudConnection $connection): Filesystem
    {
        return Storage::build([
            'driver' => 'google_drive',
            'client_id' => config('services.google.client_id'),
            'client_secret' => config('services.google.client_secret'),
            'credentials' => $connection->credentials,
            'connection_id' => $connection->id,
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

    public function directDownloadLink(CloudConnection $connection, string $path): ?string
    {
        $client = $this->client();
        $this->configureClient($client);
        $client->setAccessToken($connection->credentials);

        // Check if token is expired and we have a refresh token
        if ($client->isAccessTokenExpired() && $client->getRefreshToken()) {
            $refreshToken = $client->getRefreshToken();
            $newAccessToken = $client->fetchAccessTokenWithRefreshToken($refreshToken);

            if (! isset($newAccessToken['error']) && isset($newAccessToken['access_token'])) {
                $connection->update([
                    'credentials' => array_merge(
                        $connection->credentials,
                        ['refresh_token' => $connection->credentials['refresh_token'] ?? $refreshToken],
                        $newAccessToken,
                    ),
                    'last_synced_at' => now(),
                ]);
            }
        }

        $drive = new Drive($client);

        try {
            $file = $drive->files->get($path, ['fields' => 'webContentLink']);
            $url = $file->getWebContentLink();

            return is_string($url) && $url !== '' ? $url : null;
        } catch (\Exception $e) {
            return null;
        }
    }

    private function client(): Client
    {
        return app(Client::class);
    }

    private function configureClient(Client $client): void
    {
        $client->setClientId(config('services.google.client_id'));
        $client->setClientSecret(config('services.google.client_secret'));
        $client->setRedirectUri(config('services.google.redirect_uri'));
    }
}
