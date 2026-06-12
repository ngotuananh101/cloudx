<?php

namespace App\Providers;

use App\Models\CloudConnection;
use App\Services\CloudStorage\CloudProviderRegistry;
use App\Services\CloudStorage\CloudStorageManager;
use App\Services\CloudStorage\Connectors\DropboxConnector;
use App\Services\CloudStorage\Connectors\FtpConnector;
use App\Services\CloudStorage\Connectors\GoogleDriveConnector;
use App\Services\CloudStorage\Connectors\OneDriveConnector;
use App\Services\CloudStorage\Connectors\S3Connector;
use App\Services\CloudStorage\Connectors\SftpConnector;
use App\Services\CloudStorage\Connectors\TelegramConnector;
use App\Services\OneDrive\OneDriveAdapter;
use App\Services\OneDrive\OneDriveClient;
use Google\Client;
use Google\Service\Drive;
use GrahamCampbell\GuzzleFactory\GuzzleFactory;
use GuzzleHttp\Client as GuzzleClient;
use Illuminate\Filesystem\FilesystemAdapter;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\ServiceProvider;
use League\Flysystem\Filesystem;
use Masbug\Flysystem\GoogleDriveAdapter;
use Spatie\Dropbox\Client as DropboxClient;
use Spatie\FlysystemDropbox\DropboxAdapter;

class CloudStorageServiceProvider extends ServiceProvider
{
    /**
     * Register services.
     */
    public function register(): void
    {
        $this->app->bind(Client::class, function () {
            $client = new Client;
            if (app()->environment('local')) {
                $client->setHttpClient(new GuzzleClient(['verify' => false]));
            }

            return $client;
        });

        $this->app->bind(Drive::class, function ($app) {
            return new Drive($app->make(Client::class));
        });

        $this->app->singleton(CloudProviderRegistry::class, function ($app) {
            return new CloudProviderRegistry([
                $app->make(GoogleDriveConnector::class),
                $app->make(OneDriveConnector::class),
                $app->make(DropboxConnector::class),
                $app->make(S3Connector::class),
                $app->make(FtpConnector::class),
                $app->make(SftpConnector::class),
                $app->make(TelegramConnector::class),
            ]);
        });

        $this->app->singleton(CloudStorageManager::class, function ($app) {
            return new CloudStorageManager($app->make(CloudProviderRegistry::class));
        });
    }

    /**
     * Bootstrap services.
     */
    public function boot(): void
    {
        Storage::extend('onedrive', function ($app, array $config): FilesystemAdapter {
            $connection = $config['connection'] ?? null;

            if (! $connection instanceof CloudConnection) {
                $connectionId = $config['connection_id'] ?? null;
                $connection = CloudConnection::query()->findOrFail($connectionId);
            }

            $adapter = new OneDriveAdapter(new OneDriveClient($connection));

            return new FilesystemAdapter(
                new Filesystem($adapter),
                $adapter,
                $config
            );
        });

        Storage::extend('dropbox', function ($app, array $config): FilesystemAdapter {
            $client = app()->isLocal()
                ? new GuzzleClient([
                    'handler' => GuzzleFactory::handler(),
                    'verify' => false,
                ])
                : null;

            $adapter = new DropboxAdapter(new DropboxClient(
                (string) $config['authorization_token'],
                $client,
            ));

            return new FilesystemAdapter(
                new Filesystem($adapter, $config),
                $adapter,
                $config
            );
        });

        Storage::extend('google_drive', function ($app, $config) {
            $client = $app->make(Client::class);
            $client->setClientId($config['client_id'] ?? config('services.google.client_id'));
            $client->setClientSecret($config['client_secret'] ?? config('services.google.client_secret'));

            if (isset($config['credentials'])) {
                $client->setAccessToken($config['credentials']);

                if ($client->isAccessTokenExpired() && $client->getRefreshToken()) {
                    $refreshToken = $client->getRefreshToken();
                    $newAccessToken = $client->fetchAccessTokenWithRefreshToken($refreshToken);

                    if (! isset($newAccessToken['error']) && isset($newAccessToken['access_token'], $config['connection_id'])) {
                        $connection = CloudConnection::find($config['connection_id']);
                        if ($connection) {
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
                }
            }

            $service = new Drive($client);
            $adapter = new GoogleDriveAdapter($service, $config['folder_id'] ?? '/');

            return new FilesystemAdapter(
                new Filesystem($adapter),
                $adapter,
                $config
            );
        });
    }
}
