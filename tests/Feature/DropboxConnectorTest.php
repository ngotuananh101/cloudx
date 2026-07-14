<?php

use App\Enums\CloudProvider;
use App\Enums\ConnectionStatus;
use App\Exceptions\CloudOAuthException;
use App\Models\CloudConnection;
use App\Models\User;
use App\Services\CloudStorage\CloudStorageManager;
use App\Services\CloudStorage\Connectors\DropboxConnector;
use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;

it('defines Dropbox provider metadata', function () {
    $provider = CloudProvider::DROPBOX;

    expect($provider->slug())->toBe('dropbox')
        ->and($provider->getDescription())->toBe('Dropbox')
        ->and(CloudProvider::fromSlug('dropbox') === CloudProvider::DROPBOX)->toBeTrue()
        ->and(CloudProvider::getIcon(CloudProvider::DROPBOX->value))->toBe('/assets/svg/Dropbox.svg')
        ->and(file_exists(public_path('assets/svg/Dropbox.svg')))->toBeTrue();
});

it('builds the Dropbox OAuth redirect URL', function () {
    config()->set('services.dropbox.client_id', 'dropbox-client-id');
    config()->set('services.dropbox.redirect_uri', 'https://example.test/oauth/dropbox/callback');

    $redirectUrl = app(DropboxConnector::class)->redirectUrl();
    $redirectUrlParts = parse_url($redirectUrl);
    parse_str($redirectUrlParts['query'], $query);

    expect($redirectUrlParts['scheme'])->toBe('https')
        ->and($redirectUrlParts['host'])->toBe('www.dropbox.com')
        ->and($redirectUrlParts['path'])->toBe('/oauth2/authorize')
        ->and($query['client_id'])->toBe('dropbox-client-id')
        ->and($query['response_type'])->toBe('code')
        ->and($query['redirect_uri'])->toBe('https://example.test/oauth/dropbox/callback')
        ->and($query['token_access_type'])->toBe('offline')
        ->and($query['scope'])->toBe('account_info.read files.metadata.read files.content.read files.content.write')
        ->and($query['state'])->not->toBeEmpty()
        ->and(session('oauth_state_dropbox'))->toBe($query['state'])
        ->and($query)->not->toHaveKey('client_secret');
});

it('rejects an invalid Dropbox OAuth callback state', function () {
    session(['oauth_state_dropbox' => 'expected-state']);

    $request = Request::create('/oauth/dropbox/callback', 'GET', [
        'state' => 'invalid-state',
    ]);
    $request->setLaravelSession(session()->driver());

    app(DropboxConnector::class)->handleCallback($request);
})->throws(CloudOAuthException::class, 'Invalid Dropbox OAuth state.');

it('handles the Dropbox OAuth callback', function () {
    config()->set('services.dropbox.client_id', 'dropbox-client-id');
    config()->set('services.dropbox.client_secret', 'dropbox-client-secret');
    config()->set('services.dropbox.redirect_uri', 'https://example.test/oauth/dropbox/callback');

    session(['oauth_state_dropbox' => 'valid-state']);

    Http::preventStrayRequests();

    Http::fake([
        DropboxConnector::TOKEN_URL => Http::response([
            'access_token' => 'dropbox-access-token',
            'refresh_token' => 'dropbox-refresh-token',
            'expires_in' => 14400,
            'token_type' => 'bearer',
            'account_id' => 'dbid:test-account',
        ]),
        DropboxConnector::CURRENT_ACCOUNT_URL => Http::response([
            'account_id' => 'dbid:test-account',
            'name' => ['display_name' => 'Dropbox User'],
            'email' => 'dropbox@example.com',
        ]),
        DropboxConnector::SPACE_USAGE_URL => Http::response([
            'used' => 1024,
            'allocation' => [
                '.tag' => 'individual',
                'allocated' => 4096,
            ],
        ]),
    ]);

    $request = Request::create('/oauth/dropbox/callback', 'GET', [
        'code' => 'valid-code',
        'state' => 'valid-state',
    ]);
    $request->setLaravelSession(session()->driver());

    $account = app(DropboxConnector::class)->handleCallback($request);

    expect($account->providerId)->toBe('dbid:test-account')
        ->and($account->name)->toBe('Dropbox (dropbox@example.com)')
        ->and($account->credentials['access_token'])->toBe('dropbox-access-token')
        ->and($account->credentials['refresh_token'])->toBe('dropbox-refresh-token')
        ->and($account->credentials['expires_at'])->toBeInt()
        ->and($account->credentials['expires_at'])->toBeGreaterThan(now()->addHours(3)->timestamp)
        ->and($account->totalSpace)->toBe(4096)
        ->and($account->usedSpace)->toBe(1024)
        ->and(session()->has('oauth_state_dropbox'))->toBeFalse();

    Http::assertSent(fn ($request): bool => $request->method() === 'POST'
        && $request->url() === DropboxConnector::TOKEN_URL
        && $request->isForm()
        && $request['client_id'] === 'dropbox-client-id'
        && $request['client_secret'] === 'dropbox-client-secret'
        && $request['code'] === 'valid-code'
        && $request['redirect_uri'] === 'https://example.test/oauth/dropbox/callback'
        && $request['grant_type'] === 'authorization_code');

    Http::assertSent(fn ($request): bool => $request->url() === DropboxConnector::CURRENT_ACCOUNT_URL
        && $request->hasHeader('Authorization', 'Bearer dropbox-access-token')
        && $request->body() === 'null');

    Http::assertSent(fn ($request): bool => $request->url() === DropboxConnector::SPACE_USAGE_URL
        && $request->hasHeader('Authorization', 'Bearer dropbox-access-token')
        && $request->body() === 'null');
});

it('builds a Dropbox disk from a connected account', function () {
    $user = User::factory()->create();
    $connection = CloudConnection::create([
        'user_id' => $user->id,
        'name' => 'Dropbox',
        'provider' => CloudProvider::DROPBOX,
        'provider_id' => 'dbid:test-account',
        'credentials' => [
            'access_token' => 'fresh-dropbox-token',
            'refresh_token' => 'dropbox-refresh-token',
            'expires_at' => now()->addHour()->timestamp,
        ],
        'status' => ConnectionStatus::CONNECTED,
    ]);

    Storage::shouldReceive('build')
        ->once()
        ->with([
            'driver' => 'dropbox',
            'authorization_token' => 'fresh-dropbox-token',
        ])
        ->andReturn(Mockery::mock(Filesystem::class));

    $disk = app(DropboxConnector::class)->disk($connection);

    expect($disk)->toBeInstanceOf(Filesystem::class);
});

it('refreshes an expired Dropbox token before building a disk', function () {
    config()->set('services.dropbox.client_id', 'dropbox-client-id');
    config()->set('services.dropbox.client_secret', 'dropbox-client-secret');

    Http::preventStrayRequests();
    Http::fake([
        DropboxConnector::TOKEN_URL => Http::response([
            'access_token' => 'refreshed-dropbox-token',
            'expires_in' => 14400,
            'token_type' => 'bearer',
        ]),
    ]);

    $connection = CloudConnection::factory()->create([
        'provider' => CloudProvider::DROPBOX,
        'credentials' => [
            'access_token' => 'expired-dropbox-token',
            'refresh_token' => 'dropbox-refresh-token',
            'expires_at' => now()->subMinute()->timestamp,
        ],
    ]);

    Storage::shouldReceive('build')
        ->once()
        ->with([
            'driver' => 'dropbox',
            'authorization_token' => 'refreshed-dropbox-token',
        ])
        ->andReturn(Mockery::mock(Filesystem::class));

    app(DropboxConnector::class)->disk($connection);

    expect($connection->refresh()->credentials['access_token'])->toBe('refreshed-dropbox-token')
        ->and($connection->credentials['refresh_token'])->toBe('dropbox-refresh-token')
        ->and($connection->credentials['expires_at'])->toBeGreaterThan(now()->addHours(3)->timestamp);

    Http::assertSent(fn ($request): bool => $request->method() === 'POST'
        && $request->url() === DropboxConnector::TOKEN_URL
        && $request->isForm()
        && $request['grant_type'] === 'refresh_token'
        && $request['refresh_token'] === 'dropbox-refresh-token'
        && $request['client_id'] === 'dropbox-client-id'
        && $request['client_secret'] === 'dropbox-client-secret');
});

it('exposes Dropbox provider capabilities', function () {
    $capabilities = app(DropboxConnector::class)->capabilities()->toArray();

    expect($capabilities)->toMatchArray([
        'browse' => true,
        'upload' => true,
        'download' => true,
        'delete' => true,
        'createFolder' => true,
        'share' => true,
    ]);
});

it('resolves the Dropbox connector from the cloud storage manager', function () {
    expect(app(CloudStorageManager::class)->connector(CloudProvider::DROPBOX)->provider())
        ->toBe(CloudProvider::DROPBOX);
});

it('allows Dropbox OAuth connections to reconnect and edit their display name', function () {
    $connection = CloudConnection::factory()->create([
        'provider' => CloudProvider::DROPBOX,
    ]);

    expect($connection->canReconnect())->toBeTrue()
        ->and($connection->canEditName())->toBeTrue()
        ->and($connection->canEditConnection())->toBeFalse()
        ->and($connection->actions())->toMatchArray([
            'canReconnect' => true,
            'canEditName' => true,
            'canEditConnection' => false,
            'canDelete' => true,
        ]);
});
