<?php

use App\Data\ProviderCapabilities;
use App\Enums\CloudProvider;
use App\Enums\ConnectionStatus;
use App\Models\CloudConnection;
use App\Models\User;
use App\Services\CloudStorage\CloudProviderRegistry;
use App\Services\CloudStorage\Connectors\FtpConnector;
use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Support\Facades\Storage;

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
        share: true,
        move: true,
    ));
});

it('reports editable FTP connection actions without reconnect', function () {
    $connection = CloudConnection::factory()->make([
        'provider' => CloudProvider::FTP,
        'status' => ConnectionStatus::CONNECTED,
    ]);

    expect($connection->actions())->toBe([
        'canReconnect' => false,
        'canEditName' => true,
        'canEditConnection' => true,
        'canDelete' => true,
    ]);
});

it('builds an FTP disk from encrypted connection credentials', function () {
    $connection = CloudConnection::factory()->create([
        'provider' => CloudProvider::FTP,
        'credentials' => ftpCredentials(),
    ]);
    $disk = Mockery::mock(Filesystem::class);
    Storage::shouldReceive('build')->once()->andReturn($disk);

    $builtDisk = app(CloudProviderRegistry::class)
        ->for(CloudProvider::FTP())
        ->disk($connection);

    expect($builtDisk)->toBe($disk);
});

it('requires successful FTP connection test before saving', function () {
    Storage::shouldReceive('build')
        ->once()
        ->andThrow(new RuntimeException('Connection failed'));

    $response = $this->actingAs(User::factory()->create())
        ->from('/dashboard')
        ->post(route('connections.ftp.store'), ftpPayload());

    $response->assertRedirect('/dashboard');
    $response->assertSessionHasErrors('host');
    expect(CloudConnection::query()->count())->toBe(0);
});

it('creates FTP connection after testing credentials', function () {
    $disk = Mockery::mock(Filesystem::class);
    $disk->shouldReceive('listContents')->once()->with('', false)->andReturn(collect());
    Storage::shouldReceive('build')->once()->andReturn($disk);

    $response = $this->actingAs(User::factory()->create())
        ->post(route('connections.ftp.store'), ftpPayload());

    $response->assertRedirect(route('dashboard'));

    $connection = CloudConnection::query()->sole();

    expect($connection->provider->is(CloudProvider::FTP))->toBeTrue()
        ->and($connection->status->is(ConnectionStatus::CONNECTED))->toBeTrue()
        ->and($connection->provider_id)->toBe('ftp-user@ftp.example.test:2121/uploads')
        ->and($connection->total_space)->toBeNull()
        ->and($connection->used_space)->toBeNull()
        ->and($connection->credentials)->toMatchArray(ftpCredentials());
});

it('shares safe FTP config for dashboard connections without password', function () {
    $this->withoutVite();

    $user = User::factory()->create();
    CloudConnection::factory()->create([
        'user_id' => $user->id,
        'provider' => CloudProvider::FTP,
        'credentials' => ftpCredentials(['password' => 'super-secret']),
    ]);
    CloudConnection::factory()->create([
        'user_id' => $user->id,
        'provider' => CloudProvider::GOOGLE_DRIVE,
        'credentials' => ['access_token' => 'google-token'],
    ]);

    $response = $this->actingAs($user)->get(route('dashboard'));

    $response->assertOk();
    $page = $response->viewData('page');

    expect(data_get($page, 'props.auth.user.connections.0.ftp_config.host'))->toBe('ftp.example.test')
        ->and(data_get($page, 'props.auth.user.connections.0.ftp_config.port'))->toBe(2121)
        ->and(data_get($page, 'props.auth.user.connections.0.ftp_config.ignore_passive_address'))->toBeFalse()
        ->and(data_get($page, 'props.auth.user.connections.0.ftp_config.password'))->toBeNull()
        ->and(data_get($page, 'props.auth.user.connections.1.ftp_config'))->toBeNull();
});

it('preserves password on update when password is blank', function () {
    $user = User::factory()->create();
    $connection = CloudConnection::factory()->create([
        'user_id' => $user->id,
        'provider' => CloudProvider::FTP,
        'credentials' => ftpCredentials(['password' => 'existing-secret']),
    ]);
    $disk = Mockery::mock(Filesystem::class);
    $disk->shouldReceive('listContents')->once()->with('', false)->andReturn(collect());
    Storage::shouldReceive('build')->once()->andReturn($disk);

    $response = $this->actingAs($user)
        ->patch(route('connections.ftp.update', $connection), ftpPayload([
            'name' => 'Updated FTP',
            'password' => '',
        ]));

    $response->assertRedirect(route('dashboard'));

    $connection->refresh();

    expect($connection->name)->toBe('Updated FTP')
        ->and($connection->credentials['password'])->toBe('existing-secret');
});

it('replaces password on update when new password is supplied', function () {
    $user = User::factory()->create();
    $connection = CloudConnection::factory()->create([
        'user_id' => $user->id,
        'provider' => CloudProvider::FTP,
        'credentials' => ftpCredentials(['password' => 'existing-secret']),
    ]);
    $disk = Mockery::mock(Filesystem::class);
    $disk->shouldReceive('listContents')->once()->with('', false)->andReturn(collect());
    Storage::shouldReceive('build')->once()->andReturn($disk);

    $response = $this->actingAs($user)
        ->patch(route('connections.ftp.update', $connection), ftpPayload([
            'password' => 'new-secret',
        ]));

    $response->assertRedirect(route('dashboard'));

    expect($connection->refresh()->credentials['password'])->toBe('new-secret');
});

/**
 * @param  array<string, mixed>  $overrides
 * @return array<string, mixed>
 */
function ftpPayload(array $overrides = []): array
{
    return [
        'name' => 'FTP Server',
        'host' => 'ftp.example.test',
        'port' => 2121,
        'username' => 'ftp-user',
        'password' => 'secret',
        'root' => '/uploads',
        'passive' => false,
        'ssl' => false,
        'timeout' => 45,
        'utf8' => true,
        'ignorePassiveAddress' => false,
        'systemType' => 'unix',
        'recurseManually' => false,
        'timestampsOnUnixListingsEnabled' => true,
        ...$overrides,
    ];
}

/**
 * @param  array<string, mixed>  $overrides
 * @return array<string, mixed>
 */
function ftpCredentials(array $overrides = []): array
{
    return [
        'host' => 'ftp.example.test',
        'port' => 2121,
        'username' => 'ftp-user',
        'password' => 'secret',
        'root' => '/uploads',
        'passive' => false,
        'ssl' => false,
        'timeout' => 45,
        'utf8' => true,
        'ignore_passive_address' => false,
        'system_type' => 'unix',
        'recurse_manually' => false,
        'timestamps_on_unix_listings_enabled' => true,
        ...$overrides,
    ];
}
