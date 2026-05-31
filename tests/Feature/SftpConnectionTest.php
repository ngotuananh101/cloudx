<?php

use App\Data\ProviderCapabilities;
use App\Enums\CloudProvider;
use App\Models\CloudConnection;
use App\Models\User;
use App\Services\CloudStorage\CloudProviderRegistry;
use App\Services\CloudStorage\Connectors\SftpConnector;
use Illuminate\Contracts\Filesystem\Filesystem;

it('registers the sftp provider connector', function () {
    $connector = app(CloudProviderRegistry::class)->for(CloudProvider::SFTP());

    expect($connector)->toBeInstanceOf(SftpConnector::class);
});

it('exposes sftp provider capabilities', function () {
    $capabilities = app(SftpConnector::class)->capabilities();

    expect($capabilities)->toBeInstanceOf(ProviderCapabilities::class)
        ->and($capabilities->toArray())->toMatchArray([
            'browse' => true,
            'upload' => true,
            'download' => true,
            'delete' => true,
            'createFolder' => true,
            'share' => false,
        ]);
});

it('builds an sftp disk config from connection credentials', function () {
    $connector = app(SftpConnector::class);

    $config = $connector->diskConfig([
        'host' => 'sftp.example.com',
        'port' => 2222,
        'username' => 'alice',
        'password' => 'secret',
        'privateKey' => null,
        'passphrase' => null,
        'root' => '/uploads',
        'timeout' => 30,
        'useAgent' => false,
        'hostFingerprint' => null,
    ]);

    expect($config)
        ->toHaveKey('driver', 'sftp')
        ->toHaveKey('host', 'sftp.example.com')
        ->toHaveKey('port', 2222)
        ->toHaveKey('username', 'alice')
        ->toHaveKey('password', 'secret')
        ->toHaveKey('root', '/uploads')
        ->toHaveKey('timeout', 30);
});

it('builds an sftp disk from encrypted connection credentials', function () {
    $connection = CloudConnection::factory()->for(User::factory())->create([
        'provider' => CloudProvider::SFTP(),
        'credentials' => [
            'host' => 'sftp.example.com',
            'port' => 22,
            'username' => 'alice',
            'password' => 'secret',
            'root' => '/',
            'timeout' => 30,
        ],
    ]);

    $disk = app(SftpConnector::class)->disk($connection);

    expect($disk)->toBeInstanceOf(Filesystem::class);
});

it('resolves sftp enum slug and description', function () {
    $provider = CloudProvider::SFTP();

    expect($provider->slug())->toBe('sftp')
        ->and($provider->description)->toBe('SFTP Server')
        ->and(CloudProvider::fromSlug('sftp'))->not->toBeNull()
        ->and(CloudProvider::getIcon(CloudProvider::SFTP))->toBe('/assets/svg/Sftp.svg');
});
