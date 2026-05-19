<?php

use App\Enums\CloudProvider;
use App\Enums\ConnectionStatus;
use App\Models\CloudConnection;
use App\Models\User;
use Google\Client;
use Google\Service\Drive;
use Google\Service\Drive\About;
use Google\Service\Drive\AboutStorageQuota;
use Google\Service\Drive\AboutUser;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;

uses(RefreshDatabase::class);

it('creates a cloud connection and casts attributes correctly', function () {
    $user = User::factory()->create();

    $credentials = ['access_token' => 'test_token', 'refresh_token' => 'refresh'];

    $connection = CloudConnection::create([
        'user_id' => $user->id,
        'name' => 'My Google Drive',
        'provider' => CloudProvider::GOOGLE_DRIVE,
        'credentials' => $credentials,
        'status' => ConnectionStatus::CONNECTED,
        'total_space' => 15000000000,
        'used_space' => 5000000000,
    ]);

    // Check relationship
    expect($connection->user->id)->toBe($user->id);

    // Check enums
    expect($connection->provider->value)->toBe(CloudProvider::GOOGLE_DRIVE)
        ->and($connection->status->value)->toBe(ConnectionStatus::CONNECTED);

    // Check credentials casting (it should return array in PHP)
    expect($connection->credentials)->toBeArray()
        ->and($connection->credentials['access_token'])->toBe('test_token');

    // Verify it is actually encrypted in the database
    $rawRecord = DB::table('cloud_connections')->where('id', $connection->id)->first();

    // The raw string in database should not be a raw JSON containing 'test_token'
    expect($rawRecord->credentials)->not->toContain('test_token');
});

it('redirects to Google OAuth URL', function () {
    $user = User::factory()->create();

    $mockClient = Mockery::mock(Client::class);
    $mockClient->shouldReceive('setClientId')->once();
    $mockClient->shouldReceive('setClientSecret')->once();
    $mockClient->shouldReceive('setRedirectUri')->once();
    $mockClient->shouldReceive('addScope')->once();
    $mockClient->shouldReceive('setAccessType')->once()->with('offline');
    $mockClient->shouldReceive('setPrompt')->once()->with('consent');
    $mockClient->shouldReceive('createAuthUrl')->once()->andReturn('https://accounts.google.com/o/oauth2/auth?test=1');

    $this->app->instance(Client::class, $mockClient);

    $response = $this->actingAs($user)->get(route('oauth.google.redirect'));

    $response->assertRedirect('https://accounts.google.com/o/oauth2/auth?test=1');
});

it('handles Google OAuth callback successfully', function () {
    $user = User::factory()->create();

    $mockClient = Mockery::mock(Client::class);
    $mockClient->shouldReceive('setClientId')->once();
    $mockClient->shouldReceive('setClientSecret')->once();
    $mockClient->shouldReceive('setRedirectUri')->once();
    $mockClient->shouldReceive('fetchAccessTokenWithAuthCode')->once()->with('valid_code')->andReturn([
        'access_token' => 'mock_access_token',
        'refresh_token' => 'mock_refresh_token',
        'expires_in' => 3600,
    ]);
    $mockClient->shouldReceive('setAccessToken')->once();

    $this->app->instance(Client::class, $mockClient);

    // Mock Drive Service
    $mockDrive = Mockery::mock(Drive::class);

    // We need to mock $driveService->about->get(...)
    $mockAboutResource = Mockery::mock(Drive\Resource\About::class);

    $mockAbout = Mockery::mock(About::class);

    $mockUser = Mockery::mock(AboutUser::class);
    $mockUser->shouldReceive('getEmailAddress')->once()->andReturn('test@gmail.com');

    $mockQuota = Mockery::mock(AboutStorageQuota::class);
    $mockQuota->shouldReceive('getLimit')->once()->andReturn(15000000000);
    $mockQuota->shouldReceive('getUsage')->once()->andReturn(5000000000);

    $mockAbout->shouldReceive('getUser')->once()->andReturn($mockUser);
    $mockAbout->shouldReceive('getStorageQuota')->once()->andReturn($mockQuota);

    $mockAboutResource->shouldReceive('get')->once()->with(['fields' => 'user,storageQuota'])->andReturn($mockAbout);

    $mockDrive->about = $mockAboutResource;

    $this->app->instance(Drive::class, $mockDrive);

    $response = $this->actingAs($user)->get(route('oauth.google.callback', ['code' => 'valid_code']));

    $response->assertRedirect(route('dashboard'));
    $response->assertSessionHas('success', 'Successfully connected to Google Drive!');

    // Verify CloudConnection record was created
    $connection = $user->cloudConnections()->first();
    expect($connection)->not->toBeNull()
        ->and($connection->provider->value)->toBe(CloudProvider::GOOGLE_DRIVE)
        ->and($connection->status->value)->toBe(ConnectionStatus::CONNECTED)
        ->and($connection->credentials['access_token'])->toBe('mock_access_token')
        ->and($connection->credentials['refresh_token'])->toBe('mock_refresh_token')
        ->and($connection->total_space)->toBe(15000000000)
        ->and($connection->used_space)->toBe(5000000000);
});

it('can disconnect a cloud connection', function () {
    $user = User::factory()->create();

    $connection = CloudConnection::create([
        'user_id' => $user->id,
        'name' => 'Google Drive (test@gmail.com)',
        'provider' => CloudProvider::GOOGLE_DRIVE,
        'credentials' => ['access_token' => 'token'],
        'status' => ConnectionStatus::CONNECTED,
    ]);

    $response = $this->actingAs($user)->delete(route('cloud-connections.destroy', $connection));

    $response->assertRedirect(route('dashboard'));
    $response->assertSessionHas('success', 'Successfully disconnected Google Drive (test@gmail.com)');

    expect(CloudConnection::find($connection->id))->toBeNull();
});
