<?php

use App\Data\ConnectedAccountData;
use App\Enums\ActivityAction;
use App\Enums\CloudProvider;
use App\Enums\ConnectionStatus;
use App\Models\ActivityLog;
use App\Models\CloudConnection;
use App\Models\User;
use App\Services\CloudStorage\CloudStorageManager;
use App\Services\CloudStorage\Connectors\GoogleDriveConnector;
use App\Services\CloudStorage\Contracts\CloudProviderConnector;
use Google\Client;
use Google\Service\Drive;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

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
    expect($connection->provider)->toBe(CloudProvider::GOOGLE_DRIVE)
        ->and($connection->status)->toBe(ConnectionStatus::CONNECTED);

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

    $connector = Mockery::mock(CloudProviderConnector::class);
    $connector->shouldReceive('redirectUrl')->once()->andReturn('https://accounts.google.com/o/oauth2/auth?test=1');

    $manager = Mockery::mock(CloudStorageManager::class);
    $manager->shouldReceive('connector')->once()->with(Mockery::on(
        fn (CloudProvider $provider): bool => $provider === CloudProvider::GOOGLE_DRIVE
    ))->andReturn($connector);

    $this->app->instance(CloudStorageManager::class, $manager);

    $response = $this->actingAs($user)->get(route('oauth.redirect', ['provider' => 'google-drive']));

    $response->assertRedirect('https://accounts.google.com/o/oauth2/auth?test=1');
});

it('google connector creates redirect url', function () {
    config(['services.google.redirect_uri' => 'https://cloudx.test/oauth/google-drive/callback']);

    $mockClient = Mockery::mock(Client::class);
    $mockClient->shouldReceive('setClientId')->once();
    $mockClient->shouldReceive('setClientSecret')->once();
    $mockClient->shouldReceive('setRedirectUri')->once()->with(config('services.google.redirect_uri'));
    $mockClient->shouldReceive('addScope')->once()->with(Drive::DRIVE);
    $mockClient->shouldReceive('setAccessType')->once()->with('offline');
    $mockClient->shouldReceive('setPrompt')->once()->with('consent');
    $mockClient->shouldReceive('setState')->once()->with(Mockery::type('string'));
    $mockClient->shouldReceive('createAuthUrl')->once()->andReturn('https://accounts.google.com/o/oauth2/auth?test=1');

    $this->app->instance(Client::class, $mockClient);

    $connector = app(GoogleDriveConnector::class);

    expect($connector->redirectUrl())->toBe('https://accounts.google.com/o/oauth2/auth?test=1');
});

it('handles Google OAuth callback successfully', function () {
    $user = User::factory()->create();

    $connector = Mockery::mock(CloudProviderConnector::class);
    $connector->shouldReceive('handleCallback')->once()->with(Mockery::type(Request::class))->andReturn(new ConnectedAccountData(
        providerId: 'test@gmail.com',
        name: 'Google Drive (test@gmail.com)',
        credentials: [
            'access_token' => 'mock_access_token',
            'refresh_token' => 'mock_refresh_token',
            'expires_in' => 3600,
        ],
        totalSpace: 15000000000,
        usedSpace: 5000000000,
    ));

    $manager = Mockery::mock(CloudStorageManager::class);
    $manager->shouldReceive('connector')->once()->with(Mockery::on(
        fn (CloudProvider $provider): bool => $provider === CloudProvider::GOOGLE_DRIVE
    ))->andReturn($connector);

    $this->app->instance(CloudStorageManager::class, $manager);

    $response = $this->actingAs($user)->get(route('oauth.callback', [
        'provider' => 'google-drive',
        'code' => 'valid_code',
    ]));

    $response->assertRedirect(route('dashboard'));
    $response->assertSessionHas('success', 'Successfully connected to Google Drive!');

    $connection = $user->cloudConnections()->first();
    expect($connection)->not->toBeNull()
        ->and($connection->provider)->toBe(CloudProvider::GOOGLE_DRIVE)
        ->and($connection->provider_id)->toBe('test@gmail.com')
        ->and($connection->name)->toBe('Google Drive (test@gmail.com)')
        ->and($connection->status)->toBe(ConnectionStatus::CONNECTED)
        ->and($connection->credentials['access_token'])->toBe('mock_access_token')
        ->and($connection->credentials['refresh_token'])->toBe('mock_refresh_token')
        ->and($connection->total_space)->toBe(15000000000)
        ->and($connection->used_space)->toBe(5000000000);

    $log = ActivityLog::query()->where('user_id', $user->id)->sole();
    expect($log->action)->toBe(ActivityAction::ConnectionCreated)
        ->and($log->subject_name)->toBe('Google Drive (test@gmail.com)')
        ->and($log->cloud_connection_id)->toBe($connection->id);
});

it('returns 404 for unsupported OAuth providers', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->get(route('oauth.redirect', ['provider' => 'unsupported']))
        ->assertNotFound();
});

it('delegates disk creation to the cloud storage manager', function () {
    $connection = new CloudConnection([
        'provider' => CloudProvider::GOOGLE_DRIVE,
        'credentials' => ['access_token' => 'token'],
        'status' => ConnectionStatus::CONNECTED,
    ]);

    Storage::fake('delegated');
    $disk = Storage::disk('delegated');

    $manager = Mockery::mock(CloudStorageManager::class);
    $manager->shouldReceive('disk')->once()->with($connection)->andReturn($disk);

    $this->app->instance(CloudStorageManager::class, $manager);

    expect($connection->getDisk())->toBe($disk);
});

it('does not persist Google refresh token error payloads', function () {
    $user = User::factory()->create();
    $connection = CloudConnection::create([
        'user_id' => $user->id,
        'name' => 'Google Drive (test@gmail.com)',
        'provider' => CloudProvider::GOOGLE_DRIVE,
        'provider_id' => 'test@gmail.com',
        'credentials' => [
            'access_token' => 'expired_token',
            'refresh_token' => 'valid_refresh_token',
            'expires_in' => -1,
            'created' => 1,
        ],
        'status' => ConnectionStatus::CONNECTED,
    ]);

    $mockClient = Mockery::mock(Client::class);
    $mockClient->shouldReceive('setClientId')->once();
    $mockClient->shouldReceive('setClientSecret')->once();
    $mockClient->shouldReceive('setAccessToken')->once()->with($connection->credentials);
    $mockClient->shouldReceive('isAccessTokenExpired')->once()->andReturnTrue();
    $mockClient->shouldReceive('getRefreshToken')->twice()->andReturn('valid_refresh_token');
    $mockClient->shouldReceive('fetchAccessTokenWithRefreshToken')
        ->once()
        ->with('valid_refresh_token')
        ->andReturn(['error' => 'invalid_grant', 'error_description' => 'Bad refresh token']);

    $this->app->instance(Client::class, $mockClient);

    try {
        Storage::build([
            'driver' => 'google_drive',
            'credentials' => $connection->credentials,
            'connection_id' => $connection->id,
        ]);
    } catch (Throwable) {
        // Adapter creation may fail because Drive is not fully mocked; persistence is the behavior under test.
    }

    $connection->refresh();

    expect($connection->credentials)->toBe([
        'access_token' => 'expired_token',
        'refresh_token' => 'valid_refresh_token',
        'expires_in' => -1,
        'created' => 1,
    ]);
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

    $log = ActivityLog::query()->where('user_id', $user->id)->sole();
    expect($log->action)->toBe(ActivityAction::ConnectionDeleted)
        ->and($log->subject_name)->toBe('Google Drive (test@gmail.com)');
});

it('shares connection action capabilities with inertia auth props', function () {
    $user = User::factory()->create();

    $connection = CloudConnection::create([
        'user_id' => $user->id,
        'name' => 'Google Drive (test@gmail.com)',
        'provider' => CloudProvider::GOOGLE_DRIVE,
        'provider_id' => 'test@gmail.com',
        'credentials' => ['access_token' => 'token'],
        'status' => ConnectionStatus::CONNECTED,
    ]);

    $response = $this->actingAs($user)->get(route('dashboard'));

    $response->assertInertia(fn ($page) => $page
        ->where('auth.user.connections.0.id', $connection->id)
        ->where('auth.user.connections.0.actions.canReconnect', true)
        ->where('auth.user.connections.0.actions.canEditName', true)
        ->where('auth.user.connections.0.actions.canEditConnection', false)
        ->where('auth.user.connections.0.actions.canDelete', true)
    );
});

it('updates a cloud connection display name', function () {
    $user = User::factory()->create();
    $connection = CloudConnection::create([
        'user_id' => $user->id,
        'name' => 'Old name',
        'provider' => CloudProvider::GOOGLE_DRIVE,
        'provider_id' => 'test@gmail.com',
        'credentials' => ['access_token' => 'token'],
        'status' => ConnectionStatus::CONNECTED,
    ]);

    $response = $this->actingAs($user)->patch(route('cloud-connections.name.update', $connection), [
        'name' => 'Personal Drive',
    ]);

    $response->assertRedirect();
    $response->assertSessionHas('success', 'Connection name updated.');

    $connection->refresh();

    expect($connection->name)->toBe('Personal Drive')
        ->and($connection->provider_id)->toBe('test@gmail.com')
        ->and($connection->credentials['access_token'])->toBe('token');
});

it('validates cloud connection display names', function () {
    $user = User::factory()->create();
    $connection = CloudConnection::create([
        'user_id' => $user->id,
        'name' => 'Google Drive',
        'provider' => CloudProvider::GOOGLE_DRIVE,
        'provider_id' => 'test@gmail.com',
        'credentials' => ['access_token' => 'token'],
        'status' => ConnectionStatus::CONNECTED,
    ]);

    $this->actingAs($user)
        ->from(route('dashboard'))
        ->patch(route('cloud-connections.name.update', $connection), ['name' => ''])
        ->assertRedirect(route('dashboard'))
        ->assertSessionHasErrors('name');

    expect($connection->fresh()->name)->toBe('Google Drive');
});

it('does not let users rename another users cloud connection', function () {
    $owner = User::factory()->create();
    $otherUser = User::factory()->create();
    $connection = CloudConnection::create([
        'user_id' => $owner->id,
        'name' => 'Owner Drive',
        'provider' => CloudProvider::GOOGLE_DRIVE,
        'provider_id' => 'owner@gmail.com',
        'credentials' => ['access_token' => 'token'],
        'status' => ConnectionStatus::CONNECTED,
    ]);

    $this->actingAs($otherUser)
        ->patch(route('cloud-connections.name.update', $connection), ['name' => 'Stolen Drive'])
        ->assertForbidden();

    expect($connection->fresh()->name)->toBe('Owner Drive');
});

it('starts reconnect for the users existing oauth connection', function () {
    $user = User::factory()->create();
    $connection = CloudConnection::create([
        'user_id' => $user->id,
        'name' => 'Google Drive (test@gmail.com)',
        'provider' => CloudProvider::GOOGLE_DRIVE,
        'provider_id' => 'test@gmail.com',
        'credentials' => ['access_token' => 'old-token'],
        'status' => ConnectionStatus::CONNECTED,
    ]);

    $connector = Mockery::mock(CloudProviderConnector::class);
    $connector->shouldReceive('redirectUrl')->once()->andReturn('https://accounts.google.com/o/oauth2/auth?reconnect=1');

    $manager = Mockery::mock(CloudStorageManager::class);
    $manager->shouldReceive('connector')->once()->with(Mockery::on(
        fn (CloudProvider $provider): bool => $provider === CloudProvider::GOOGLE_DRIVE
    ))->andReturn($connector);

    $this->app->instance(CloudStorageManager::class, $manager);

    $response = $this->actingAs($user)->get(route('cloud-connections.reconnect', $connection));

    $response->assertRedirect('https://accounts.google.com/o/oauth2/auth?reconnect=1');
    $response->assertSessionHas('cloud_connection_reconnect.connection_id', $connection->id);
    $response->assertSessionHas('cloud_connection_reconnect.provider', CloudProvider::GOOGLE_DRIVE->value);
    $response->assertSessionHas('cloud_connection_reconnect.provider_id', 'test@gmail.com');
});

it('does not let users reconnect another users cloud connection', function () {
    $owner = User::factory()->create();
    $otherUser = User::factory()->create();
    $connection = CloudConnection::create([
        'user_id' => $owner->id,
        'name' => 'Owner Drive',
        'provider' => CloudProvider::GOOGLE_DRIVE,
        'provider_id' => 'owner@gmail.com',
        'credentials' => ['access_token' => 'old-token'],
        'status' => ConnectionStatus::CONNECTED,
    ]);

    $this->actingAs($otherUser)
        ->get(route('cloud-connections.reconnect', $connection))
        ->assertForbidden();
});

it('updates the existing connection when reconnect returns the same account', function () {
    $user = User::factory()->create();
    $connection = CloudConnection::create([
        'user_id' => $user->id,
        'name' => 'Old Drive Name',
        'provider' => CloudProvider::GOOGLE_DRIVE,
        'provider_id' => 'test@gmail.com',
        'credentials' => ['access_token' => 'old-token'],
        'status' => ConnectionStatus::CONNECTED,
        'total_space' => 10,
        'used_space' => 5,
    ]);

    session([
        'cloud_connection_reconnect' => [
            'connection_id' => $connection->id,
            'provider' => CloudProvider::GOOGLE_DRIVE->value,
            'provider_id' => 'test@gmail.com',
        ],
    ]);

    $connector = Mockery::mock(CloudProviderConnector::class);
    $connector->shouldReceive('handleCallback')->once()->with(Mockery::type(Request::class))->andReturn(new ConnectedAccountData(
        providerId: 'test@gmail.com',
        name: 'Google Drive (test@gmail.com)',
        credentials: ['access_token' => 'new-token', 'refresh_token' => 'new-refresh-token'],
        totalSpace: 100,
        usedSpace: 25,
    ));

    $manager = Mockery::mock(CloudStorageManager::class);
    $manager->shouldReceive('connector')->once()->with(Mockery::on(
        fn (CloudProvider $provider): bool => $provider === CloudProvider::GOOGLE_DRIVE
    ))->andReturn($connector);

    $this->app->instance(CloudStorageManager::class, $manager);

    $response = $this->actingAs($user)->get(route('oauth.callback', [
        'provider' => 'google-drive',
        'code' => 'valid_code',
    ]));

    $response->assertRedirect(route('dashboard'));
    $response->assertSessionHas('success', 'Successfully reconnected Old Drive Name.');
    $response->assertSessionMissing('cloud_connection_reconnect');

    $connection->refresh();

    expect($connection->name)->toBe('Old Drive Name')
        ->and($connection->provider_id)->toBe('test@gmail.com')
        ->and($connection->credentials['access_token'])->toBe('new-token')
        ->and($connection->credentials['refresh_token'])->toBe('new-refresh-token')
        ->and($connection->total_space)->toBe(100)
        ->and($connection->used_space)->toBe(25)
        ->and($connection->error_message)->toBeNull()
        ->and($connection->last_synced_at)->not->toBeNull();
});

it('rejects reconnect when oauth returns a different account', function () {
    $user = User::factory()->create();
    $connection = CloudConnection::create([
        'user_id' => $user->id,
        'name' => 'Original Drive',
        'provider' => CloudProvider::GOOGLE_DRIVE,
        'provider_id' => 'original@gmail.com',
        'credentials' => ['access_token' => 'old-token'],
        'status' => ConnectionStatus::CONNECTED,
        'total_space' => 10,
        'used_space' => 5,
    ]);

    session([
        'cloud_connection_reconnect' => [
            'connection_id' => $connection->id,
            'provider' => CloudProvider::GOOGLE_DRIVE->value,
            'provider_id' => 'original@gmail.com',
        ],
    ]);

    $connector = Mockery::mock(CloudProviderConnector::class);
    $connector->shouldReceive('handleCallback')->once()->with(Mockery::type(Request::class))->andReturn(new ConnectedAccountData(
        providerId: 'different@gmail.com',
        name: 'Google Drive (different@gmail.com)',
        credentials: ['access_token' => 'new-token'],
        totalSpace: 100,
        usedSpace: 25,
    ));

    $manager = Mockery::mock(CloudStorageManager::class);
    $manager->shouldReceive('connector')->once()->with(Mockery::on(
        fn (CloudProvider $provider): bool => $provider === CloudProvider::GOOGLE_DRIVE
    ))->andReturn($connector);

    $this->app->instance(CloudStorageManager::class, $manager);

    $response = $this->actingAs($user)->get(route('oauth.callback', [
        'provider' => 'google-drive',
        'code' => 'valid_code',
    ]));

    $response->assertRedirect(route('dashboard'));
    $response->assertSessionHas('error', 'Reconnect failed because the selected account does not match Original Drive.');
    $response->assertSessionMissing('cloud_connection_reconnect');

    $connection->refresh();

    expect($connection->provider_id)->toBe('original@gmail.com')
        ->and($connection->credentials['access_token'])->toBe('old-token')
        ->and($connection->total_space)->toBe(10)
        ->and($connection->used_space)->toBe(5)
        ->and(CloudConnection::count())->toBe(1);
});

it('does not let users delete another users cloud connection', function () {
    $owner = User::factory()->create();
    $otherUser = User::factory()->create();
    $connection = CloudConnection::create([
        'user_id' => $owner->id,
        'name' => 'Owner Drive',
        'provider' => CloudProvider::GOOGLE_DRIVE,
        'provider_id' => 'owner@gmail.com',
        'credentials' => ['access_token' => 'token'],
        'status' => ConnectionStatus::CONNECTED,
    ]);

    $this->actingAs($otherUser)
        ->delete(route('cloud-connections.destroy', $connection))
        ->assertForbidden();

    expect(CloudConnection::find($connection->id))->not->toBeNull();
});
