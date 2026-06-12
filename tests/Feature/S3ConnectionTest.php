<?php

use App\Data\ProviderCapabilities;
use App\Enums\CloudProvider;
use App\Enums\ConnectionStatus;
use App\Models\CloudConnection;
use App\Models\User;
use App\Services\CloudStorage\CloudProviderRegistry;
use App\Services\CloudStorage\Connectors\S3Connector;
use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Support\Facades\Storage;

it('resolves the S3 connector from the registry', function () {
    $connector = app(CloudProviderRegistry::class)->for(CloudProvider::AWS_S3());

    expect($connector)->toBeInstanceOf(S3Connector::class);
});

it('reports the expected S3 provider capabilities', function () {
    $capabilities = app(CloudProviderRegistry::class)
        ->for(CloudProvider::AWS_S3())
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

it('reports editable S3 connection actions without reconnect', function () {
    $connection = CloudConnection::factory()->make([
        'provider' => CloudProvider::AWS_S3,
        'status' => ConnectionStatus::CONNECTED,
    ]);

    expect($connection->actions())->toBe([
        'canReconnect' => false,
        'canEditName' => true,
        'canEditConnection' => true,
        'canDelete' => true,
    ]);
});

it('builds S3 disk config for aws preset', function () {
    $config = app(S3Connector::class)->diskConfig(s3Credentials());

    expect($config)
        ->toHaveKey('driver', 's3')
        ->toHaveKey('key', 'access-key')
        ->toHaveKey('secret', 'secret-key')
        ->toHaveKey('region', 'us-east-1')
        ->toHaveKey('bucket', 'cloudx-bucket')
        ->toHaveKey('use_path_style_endpoint', false)
        ->not->toHaveKey('endpoint');
});

it('builds S3 disk config for custom endpoint preset', function () {
    $config = app(S3Connector::class)->diskConfig(s3Credentials([
        'provider_preset' => 'minio',
        'endpoint' => 'http://127.0.0.1:9000',
        'use_path_style_endpoint' => true,
    ]));

    expect($config)
        ->toHaveKey('endpoint', 'http://127.0.0.1:9000')
        ->toHaveKey('use_path_style_endpoint', true);
});

it('builds an S3 disk from encrypted connection credentials', function () {
    $connection = CloudConnection::factory()->create([
        'provider' => CloudProvider::AWS_S3,
        'credentials' => s3Credentials(),
    ]);
    $disk = Mockery::mock(Filesystem::class);
    Storage::shouldReceive('build')->once()->andReturn($disk);

    $builtDisk = app(CloudProviderRegistry::class)
        ->for(CloudProvider::AWS_S3())
        ->disk($connection);

    expect($builtDisk)->toBe($disk);
});

it('requires successful S3 connection test before saving', function () {
    Storage::shouldReceive('build')
        ->once()
        ->andThrow(new RuntimeException('Connection failed'));

    $response = $this->actingAs(User::factory()->create())
        ->from('/dashboard')
        ->post(route('connections.s3.store'), s3Payload());

    $response->assertRedirect('/dashboard');
    $response->assertSessionHasErrors('bucket');
    expect(CloudConnection::query()->count())->toBe(0);
});

it('creates S3 connection after testing credentials', function () {
    $disk = Mockery::mock(Filesystem::class);
    $disk->shouldReceive('listContents')->once()->with('', false)->andReturn(collect());
    Storage::shouldReceive('build')->once()->andReturn($disk);

    $response = $this->actingAs(User::factory()->create())
        ->post(route('connections.s3.store'), s3Payload());

    $response->assertRedirect(route('dashboard'));

    $connection = CloudConnection::query()->sole();

    expect($connection->provider->is(CloudProvider::AWS_S3))->toBeTrue()
        ->and($connection->status->is(ConnectionStatus::CONNECTED))->toBeTrue()
        ->and($connection->credentials)->toMatchArray(s3Credentials());
});

it('shares safe S3 config for dashboard connections without secret fields', function () {
    $this->withoutVite();

    $user = User::factory()->create();
    CloudConnection::factory()->create([
        'user_id' => $user->id,
        'provider' => CloudProvider::AWS_S3,
        'credentials' => s3Credentials([
            'secret_access_key' => 'super-secret',
            'session_token' => 'super-token',
        ]),
    ]);

    $response = $this->actingAs($user)->get(route('dashboard'));

    $response->assertOk();
    $page = $response->viewData('page');

    expect(data_get($page, 'props.auth.user.connections.0.s3_config.bucket'))->toBe('cloudx-bucket')
        ->and(data_get($page, 'props.auth.user.connections.0.s3_config.secret_access_key'))->toBeNull()
        ->and(data_get($page, 'props.auth.user.connections.0.s3_config.session_token'))->toBeNull();
});

it('preserves secret access key on update when secret is blank', function () {
    $user = User::factory()->create();
    $connection = CloudConnection::factory()->create([
        'user_id' => $user->id,
        'provider' => CloudProvider::AWS_S3,
        'credentials' => s3Credentials(['secret_access_key' => 'existing-secret']),
    ]);
    $disk = Mockery::mock(Filesystem::class);
    $disk->shouldReceive('listContents')->once()->with('', false)->andReturn(collect());
    Storage::shouldReceive('build')->once()->andReturn($disk);

    $response = $this->actingAs($user)
        ->patch(route('connections.s3.update', $connection), s3Payload([
            'name' => 'Updated S3',
            'secret_access_key' => '',
        ]));

    $response->assertRedirect(route('dashboard'));

    $connection->refresh();

    expect($connection->name)->toBe('Updated S3')
        ->and($connection->credentials['secret_access_key'])->toBe('existing-secret');
});

/**
 * @param  array<string, mixed>  $overrides
 * @return array<string, mixed>
 */
function s3Payload(array $overrides = []): array
{
    return [
        'name' => 'AWS S3',
        'provider_preset' => 'aws',
        'access_key_id' => 'access-key',
        'secret_access_key' => 'secret-key',
        'region' => 'us-east-1',
        'bucket' => 'cloudx-bucket',
        'endpoint' => null,
        'use_path_style_endpoint' => false,
        'root' => 'uploads',
        'session_token' => null,
        'cdn_url' => null,
        ...$overrides,
    ];
}

/**
 * @param  array<string, mixed>  $overrides
 * @return array<string, mixed>
 */
function s3Credentials(array $overrides = []): array
{
    return [
        'provider_preset' => 'aws',
        'access_key_id' => 'access-key',
        'secret_access_key' => 'secret-key',
        'region' => 'us-east-1',
        'bucket' => 'cloudx-bucket',
        'use_path_style_endpoint' => false,
        'root' => 'uploads',
        ...$overrides,
    ];
}
