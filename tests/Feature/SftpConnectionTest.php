<?php

use App\Data\ProviderCapabilities;
use App\Enums\CloudProvider;
use App\Models\CloudConnection;
use App\Models\User;
use App\Services\CloudStorage\CloudProviderRegistry;
use App\Services\CloudStorage\Connectors\SftpConnector;
use Illuminate\Contracts\Filesystem\Filesystem;

it('registers the sftp provider connector', function () {
    $connector = app(CloudProviderRegistry::class)->for(CloudProvider::SFTP);

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
            'share' => true,
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
        'provider' => CloudProvider::SFTP,
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
    $provider = CloudProvider::SFTP;

    expect($provider->slug())->toBe('sftp')
        ->and($provider->getDescription())->toBe('SFTP Server')
        ->and(CloudProvider::fromSlug('sftp'))->not->toBeNull()
        ->and(CloudProvider::getIcon(CloudProvider::SFTP->value))->toBe('/assets/svg/Sftp.svg');
});

it('does not share SFTP config in global inertia requests', function () {
    $this->withoutVite();

    $user = User::factory()->create();
    CloudConnection::factory()->create([
        'user_id' => $user->id,
        'provider' => CloudProvider::SFTP,
        'credentials' => [
            'host' => 'sftp.example.com',
            'port' => 22,
            'username' => 'alice',
            'password' => 'secret',
            'root' => '/',
            'timeout' => 30,
        ],
    ]);

    $response = $this->actingAs($user)->get(route('dashboard'));

    $response->assertOk();
    $page = $response->viewData('page');

    expect(data_get($page, 'props.auth.user.connections.0.sftp_config'))->toBeNull()
        ->and(data_get($page, 'props.auth.user.connections.0.password'))->toBeNull();
});

it('returns safe SFTP config via API endpoint for owner', function () {
    $user = User::factory()->create();
    $connection = CloudConnection::factory()->create([
        'user_id' => $user->id,
        'provider' => CloudProvider::SFTP,
        'credentials' => [
            'host' => 'sftp.example.com',
            'port' => 22,
            'username' => 'alice',
            'password' => 'secret',
            'privateKey' => 'private-key-content',
            'passphrase' => 'my-passphrase',
            'root' => '/',
            'timeout' => 30,
        ],
    ]);

    $response = $this->actingAs($user)->getJson(route('connections.edit-config', $connection));

    $response->assertOk()
        ->assertJson([
            'sftp_config' => [
                'host' => 'sftp.example.com',
                'port' => 22,
                'username' => 'alice',
                'root' => '/',
            ],
        ]);

    expect($response->json('sftp_config.password'))->toBeNull()
        ->and($response->json('sftp_config.privateKey'))->toBeNull()
        ->and($response->json('sftp_config.passphrase'))->toBeNull()
        ->and($response->json('credentials'))->toBeNull();
});

it('forbids non-owner from accessing SFTP config', function () {
    $user = User::factory()->create();
    $otherUser = User::factory()->create();
    $connection = CloudConnection::factory()->create([
        'user_id' => $otherUser->id,
        'provider' => CloudProvider::SFTP,
        'credentials' => [
            'host' => 'sftp.example.com',
        ],
    ]);

    $response = $this->actingAs($user)->getJson(route('connections.edit-config', $connection));

    $response->assertForbidden();
});
