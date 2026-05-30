<?php

use App\Data\ProviderCapabilities;
use App\Enums\CloudProvider;
use App\Models\CloudConnection;
use App\Services\CloudStorage\CloudProviderRegistry;
use App\Services\CloudStorage\Connectors\FtpConnector;
use Illuminate\Contracts\Filesystem\Filesystem;

it('resolves the FTP connector from the registry', function () {
    $connector = app(CloudProviderRegistry::class)->for(CloudProvider::FTP());

    expect($connector)->toBeInstanceOf(FtpConnector::class);
});

it('reports the expected FTP provider capabilities', function () {
    $capabilities = app(CloudProviderRegistry::class)
        ->for(CloudProvider::FTP())
        ->capabilities();

    expect($capabilities)->toEqual(new ProviderCapabilities(
        browse: true,
        upload: true,
        download: true,
        delete: true,
        createFolder: true,
        share: false,
    ));
});

it('builds an FTP disk from encrypted connection credentials', function () {
    $connection = CloudConnection::factory()->create([
        'provider' => CloudProvider::FTP,
        'credentials' => [
            'host' => 'ftp.example.test',
            'username' => 'ftp-user',
            'password' => 'secret',
            'port' => 2121,
            'root' => '/uploads',
            'passive' => false,
            'ssl' => false,
            'timeout' => 45,
            'utf8' => true,
            'ignore_passive_address' => false,
            'system_type' => 'unix',
            'recurse_manually' => false,
            'timestamps_on_unix_listings_enabled' => true,
        ],
    ]);

    $disk = app(CloudProviderRegistry::class)
        ->for(CloudProvider::FTP())
        ->disk($connection);

    expect($disk)->toBeInstanceOf(Filesystem::class);
});
