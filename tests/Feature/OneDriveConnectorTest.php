<?php

use App\Enums\CloudProvider;
use App\Enums\ConnectionStatus;
use App\Models\CloudConnection;
use App\Models\User;
use App\Services\CloudStorage\CloudStorageManager;
use App\Services\CloudStorage\Connectors\OneDriveConnector;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;

it('builds the OneDrive OAuth redirect URL', function () {
    config()->set('services.microsoft.client_id', 'test-client-id');
    config()->set('services.microsoft.redirect_uri', 'https://example.test/oauth/onedrive/callback');

    $redirectUrl = app(OneDriveConnector::class)->redirectUrl();
    $redirectUrlParts = parse_url($redirectUrl);
    parse_str($redirectUrlParts['query'], $query);

    expect($redirectUrlParts['scheme'])->toBe('https')
        ->and($redirectUrlParts['host'])->toBe('login.microsoftonline.com')
        ->and($redirectUrlParts['path'])->toBe('/common/oauth2/v2.0/authorize')
        ->and($query['client_id'])->toBe('test-client-id')
        ->and($query['response_type'])->toBe('code')
        ->and($query['redirect_uri'])->toBe('https://example.test/oauth/onedrive/callback')
        ->and($query['response_mode'])->toBe('query')
        ->and($query['scope'])->toBe('User.Read Files.ReadWrite.All offline_access')
        ->and($query['state'])->not->toBeEmpty()
        ->and(session('oauth_state_onedrive'))->toBe($query['state'])
        ->and($query)->not->toHaveKey('client_secret');
});

it('rejects an invalid OneDrive OAuth callback state', function () {
    session(['oauth_state_onedrive' => 'expected-state']);

    $request = Request::create('/cloud-connections/onedrive/callback', 'GET', [
        'state' => 'invalid-state',
    ]);
    $request->setLaravelSession(session()->driver());

    app(OneDriveConnector::class)->handleCallback($request);
})->throws(RuntimeException::class, 'Invalid OneDrive OAuth state.');

it('handles the OneDrive OAuth callback', function () {
    config()->set('services.microsoft.client_id', 'test-client-id');
    config()->set('services.microsoft.client_secret', 'test-client-secret');
    config()->set('services.microsoft.redirect_uri', 'https://example.test/oauth/onedrive/callback');

    session(['oauth_state_onedrive' => 'valid-state']);

    Http::preventStrayRequests();

    Http::fake([
        OneDriveConnector::TOKEN_URL => Http::response([
            'access_token' => 'test-access-token',
            'refresh_token' => 'test-refresh-token',
            'expires_in' => 3600,
        ]),
        'https://graph.microsoft.com/v1.0/me' => Http::response([
            'id' => 'microsoft-user-id',
            'displayName' => 'Test User',
            'userPrincipalName' => 'user@example.com',
        ]),
        'https://graph.microsoft.com/v1.0/me/drive' => Http::response([
            'quota' => [
                'total' => 1000,
                'used' => 250,
            ],
        ]),
    ]);

    $request = Request::create('/cloud-connections/onedrive/callback', 'GET', [
        'code' => 'valid-code',
        'state' => 'valid-state',
    ]);
    $request->setLaravelSession(session()->driver());

    $account = app(OneDriveConnector::class)->handleCallback($request);

    expect($account->providerId)->toBe('microsoft-user-id')
        ->and($account->name)->toBe('OneDrive (user@example.com)')
        ->and($account->credentials['access_token'])->toBe('test-access-token')
        ->and($account->credentials['refresh_token'])->toBe('test-refresh-token')
        ->and($account->credentials['expires_at'])->toBeInt()
        ->and($account->credentials['expires_at'])->toBeGreaterThan(now()->addMinutes(50)->timestamp)
        ->and($account->totalSpace)->toBe(1000)
        ->and($account->usedSpace)->toBe(250)
        ->and(session()->has('oauth_state_onedrive'))->toBeFalse();

    Http::assertSent(fn ($request): bool => $request->method() === 'POST'
        && $request->url() === OneDriveConnector::TOKEN_URL
        && $request->isForm()
        && $request['client_id'] === 'test-client-id'
        && $request['client_secret'] === 'test-client-secret'
        && $request['code'] === 'valid-code'
        && $request['redirect_uri'] === 'https://example.test/oauth/onedrive/callback'
        && $request['grant_type'] === 'authorization_code');

    Http::assertSent(fn ($request): bool => $request->url() === 'https://graph.microsoft.com/v1.0/me'
        && $request->hasHeader('Authorization', 'Bearer test-access-token'));

    Http::assertSent(fn ($request): bool => $request->url() === 'https://graph.microsoft.com/v1.0/me/drive'
        && $request->hasHeader('Authorization', 'Bearer test-access-token'));
});

it('refreshes expired microsoft tokens before graph requests', function () {
    config()->set('services.microsoft.client_id', 'test-client-id');
    config()->set('services.microsoft.client_secret', 'test-client-secret');

    Http::preventStrayRequests();

    Http::fake([
        OneDriveConnector::TOKEN_URL => Http::response([
            'access_token' => 'new-access-token',
            'refresh_token' => 'new-refresh-token',
            'expires_in' => 3600,
        ]),
    ]);

    $user = User::factory()->create();
    $connection = CloudConnection::create([
        'user_id' => $user->id,
        'name' => 'OneDrive',
        'provider' => CloudProvider::ONEDRIVE,
        'provider_id' => 'microsoft-user-id',
        'credentials' => [
            'access_token' => 'old-access-token',
            'refresh_token' => 'old-refresh-token',
            'expires_at' => now()->subMinute()->timestamp,
        ],
        'status' => ConnectionStatus::CONNECTED,
    ]);

    $credentials = app(OneDriveConnector::class)->credentialsForGraph($connection);
    $connection->refresh();

    expect($credentials['access_token'])->toBe('new-access-token')
        ->and($connection->credentials['access_token'])->toBe('new-access-token')
        ->and($connection->credentials['refresh_token'])->toBe('new-refresh-token')
        ->and($connection->credentials['expires_at'])->toBeGreaterThan(now()->addMinutes(50)->timestamp);

    Http::assertSent(fn ($request): bool => $request->method() === 'POST'
        && $request->url() === OneDriveConnector::TOKEN_URL
        && $request->isForm()
        && $request['client_id'] === 'test-client-id'
        && $request['client_secret'] === 'test-client-secret'
        && $request['refresh_token'] === 'old-refresh-token'
        && $request['grant_type'] === 'refresh_token');
});

it('lists onedrive root contents through graph', function () {
    Http::preventStrayRequests();

    Http::fake([
        'https://graph.microsoft.com/v1.0/me/drive/root/children' => Http::response([
            'value' => [
                [
                    'id' => 'folder-id',
                    'name' => 'Documents',
                    'size' => 123,
                    'lastModifiedDateTime' => '2026-05-23T10:15:30Z',
                    'webUrl' => 'https://example.test/folder',
                    'parentReference' => ['path' => '/drive/root:'],
                    'folder' => ['childCount' => 1],
                ],
                [
                    'id' => 'file-id',
                    'name' => 'Report.pdf',
                    'size' => 456,
                    'lastModifiedDateTime' => '2026-05-23T11:15:30Z',
                    'webUrl' => 'https://example.test/file',
                    'parentReference' => ['path' => '/drive/root:'],
                    'file' => ['mimeType' => 'application/pdf'],
                ],
            ],
        ]),
    ]);

    $user = User::factory()->create();
    $connection = CloudConnection::create([
        'user_id' => $user->id,
        'name' => 'OneDrive',
        'provider' => CloudProvider::ONEDRIVE,
        'provider_id' => 'microsoft-user-id',
        'credentials' => [
            'access_token' => 'valid-access-token',
            'refresh_token' => 'refresh-token',
            'expires_at' => now()->addHour()->timestamp,
        ],
        'status' => ConnectionStatus::CONNECTED,
    ]);

    $items = app(OneDriveConnector::class)->listContents($connection, '');

    expect($items)->toHaveCount(2)
        ->and($items[0])->toMatchArray([
            'id' => 'folder-id',
            'path' => 'Documents',
            'name' => 'Documents',
            'isDirectory' => true,
            'size' => 0,
            'lastModifiedTimestamp' => strtotime('2026-05-23T10:15:30Z'),
        ])
        ->and($items[1])->toMatchArray([
            'id' => 'file-id',
            'path' => 'Report.pdf',
            'name' => 'Report.pdf',
            'isDirectory' => false,
            'size' => 456,
            'lastModifiedTimestamp' => strtotime('2026-05-23T11:15:30Z'),
        ]);

    Http::assertSent(fn ($request): bool => $request->url() === 'https://graph.microsoft.com/v1.0/me/drive/root/children'
        && $request->hasHeader('Authorization', 'Bearer valid-access-token'));
});

it('encodes non-root onedrive paths before listing contents through graph', function () {
    Http::preventStrayRequests();

    $expectedUrl = 'https://graph.microsoft.com/v1.0/me/drive/root:/Folder%20A/%23hash%20%26%20%25.txt:/children';

    Http::fake([
        $expectedUrl => Http::response(['value' => []]),
    ]);

    $user = User::factory()->create();
    $connection = CloudConnection::create([
        'user_id' => $user->id,
        'name' => 'OneDrive',
        'provider' => CloudProvider::ONEDRIVE,
        'provider_id' => 'microsoft-user-id',
        'credentials' => [
            'access_token' => 'valid-access-token',
            'refresh_token' => 'refresh-token',
            'expires_at' => now()->addHour()->timestamp,
        ],
        'status' => ConnectionStatus::CONNECTED,
    ]);

    $items = app(OneDriveConnector::class)->listContents($connection, 'Folder A/#hash & %.txt');

    expect($items)->toBe([]);

    Http::assertSent(fn ($request): bool => $request->url() === $expectedUrl
        && $request->hasHeader('Authorization', 'Bearer valid-access-token'));
});

it('does not refresh microsoft tokens when they are not near expiry', function () {
    Http::preventStrayRequests();

    Http::fake([
        'https://graph.microsoft.com/v1.0/me/drive/root/children' => Http::response(['value' => []]),
    ]);

    $user = User::factory()->create();
    $connection = CloudConnection::create([
        'user_id' => $user->id,
        'name' => 'OneDrive',
        'provider' => CloudProvider::ONEDRIVE,
        'provider_id' => 'microsoft-user-id',
        'credentials' => [
            'access_token' => 'valid-access-token',
            'refresh_token' => 'refresh-token',
            'expires_at' => now()->addMinutes(11)->timestamp,
        ],
        'status' => ConnectionStatus::CONNECTED,
    ]);

    app(OneDriveConnector::class)->listContents($connection, '');

    Http::assertSentCount(1);
    Http::assertNotSent(fn ($request): bool => $request->url() === OneDriveConnector::TOKEN_URL);
});

it('throws a clear exception before refreshing expired microsoft tokens without a refresh token', function () {
    Http::preventStrayRequests();

    Http::fake([
        OneDriveConnector::TOKEN_URL => Http::response([
            'access_token' => 'new-access-token',
            'expires_in' => 3600,
        ]),
    ]);

    $user = User::factory()->create();
    $connection = CloudConnection::create([
        'user_id' => $user->id,
        'name' => 'OneDrive',
        'provider' => CloudProvider::ONEDRIVE,
        'provider_id' => 'microsoft-user-id',
        'credentials' => [
            'access_token' => 'old-access-token',
            'expires_at' => now()->subMinute()->timestamp,
        ],
        'status' => ConnectionStatus::CONNECTED,
    ]);

    try {
        app(OneDriveConnector::class)->credentialsForGraph($connection);
    } finally {
        Http::assertNothingSent();
    }
})->throws(RuntimeException::class, 'OneDrive refresh token is missing.');

it('resolves the OneDrive connector from the cloud storage manager', function () {
    expect(app(CloudStorageManager::class)->connector(CloudProvider::ONEDRIVE())->provider()->value)
        ->toBe(CloudProvider::ONEDRIVE);
});
