<?php

use App\Enums\CloudProvider;
use App\Enums\ConnectionStatus;
use App\Exceptions\CloudOAuthException;
use App\Models\CloudConnection;
use App\Models\User;
use App\Services\CloudStorage\CloudStorageManager;
use App\Services\CloudStorage\Connectors\OneDriveConnector;
use Illuminate\Contracts\Filesystem\Filesystem;
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
})->throws(CloudOAuthException::class, 'Invalid OneDrive OAuth state.');

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

it('returns a usable one drive filesystem disk', function () {
    $user = User::factory()->create();
    $connection = CloudConnection::create([
        'user_id' => $user->id,
        'name' => 'OneDrive',
        'provider' => CloudProvider::ONEDRIVE,
        'provider_id' => 'microsoft-user-id',
        'credentials' => [
            'access_token' => 'fresh-token',
            'refresh_token' => 'refresh-token',
            'expires_at' => now()->addHour()->timestamp,
        ],
        'status' => ConnectionStatus::CONNECTED,
    ]);

    $disk = app(OneDriveConnector::class)->disk($connection);

    expect($disk)->toBeInstanceOf(Filesystem::class);
});

it('resolves the OneDrive connector from the cloud storage manager', function () {
    expect(app(CloudStorageManager::class)->connector(CloudProvider::ONEDRIVE)->provider())
        ->toBe(CloudProvider::ONEDRIVE);
});
