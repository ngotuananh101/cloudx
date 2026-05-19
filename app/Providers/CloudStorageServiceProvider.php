<?php

namespace App\Providers;

use App\Models\CloudConnection;
use Google\Client;
use Google\Service\Drive;
use Illuminate\Filesystem\FilesystemAdapter;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\ServiceProvider;
use League\Flysystem\Filesystem;
use Masbug\Flysystem\GoogleDriveAdapter;

class CloudStorageServiceProvider extends ServiceProvider
{
    /**
     * Register services.
     */
    public function register(): void
    {
        $this->app->singleton(Client::class, function () {
            $client = new Client;
            if (config('app.env') === 'local') {
                $client->setHttpClient(new \GuzzleHttp\Client(['verify' => false]));
            }

            return $client;
        });

        $this->app->bind(Drive::class, function ($app) {
            return new Drive($app->make(Client::class));
        });
    }

    /**
     * Bootstrap services.
     */
    public function boot(): void
    {
        Storage::extend('google_drive', function ($app, $config) {
            $client = new Client;
            if (config('app.env') === 'local') {
                $client->setHttpClient(new \GuzzleHttp\Client(['verify' => false]));
            }
            $client->setClientId($config['client_id'] ?? config('services.google.client_id'));
            $client->setClientSecret($config['client_secret'] ?? config('services.google.client_secret'));

            if (isset($config['credentials'])) {
                $client->setAccessToken($config['credentials']);

                if ($client->isAccessTokenExpired() && $client->getRefreshToken()) {
                    $newAccessToken = $client->fetchAccessTokenWithRefreshToken($client->getRefreshToken());

                    if (isset($config['connection_id'])) {
                        $connection = CloudConnection::find($config['connection_id']);
                        if ($connection) {
                            $connection->update([
                                'credentials' => array_merge($connection->credentials, $newAccessToken),
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
