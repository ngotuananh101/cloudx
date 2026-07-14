<?php

use App\Enums\CloudProvider;
use App\Enums\ConnectionStatus;
use App\Exceptions\OneDriveException;
use App\Models\CloudConnection;
use App\Models\User;
use App\Services\OneDrive\OneDriveClient;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;

uses(RefreshDatabase::class);

const BEARER_FRESH_TOKEN = 'Bearer fresh-token';
const UPLOAD_SESSION_URL = 'https://upload.example/session';
const SOURCE_DOC_PATH = 'Source/doc.txt';
const TARGET_DOC_PATH = 'Target/doc2.txt';

function oneDriveConnection(array $credentials = []): CloudConnection
{
    $user = User::factory()->create();

    return $user->cloudConnections()->create([
        'provider' => CloudProvider::ONEDRIVE,
        'provider_id' => 'onedrive-user',
        'name' => 'OneDrive',
        'credentials' => array_merge([
            'access_token' => 'fresh-token',
            'refresh_token' => 'refresh-token',
            'expires_at' => now()->addHour()->timestamp,
        ], $credentials),
        'status' => ConnectionStatus::CONNECTED,
    ]);
}

it('returns fresh credentials without refresh request', function () {
    Http::preventStrayRequests();
    $connection = oneDriveConnection();

    $credentials = new OneDriveClient($connection)->credentials();

    expect($credentials['access_token'])->toBe('fresh-token');
});

it('refreshes expired credentials and preserves existing refresh token', function () {
    Http::preventStrayRequests();
    Http::fake([
        OneDriveClient::TOKEN_URL => Http::response([
            'access_token' => 'new-token',
            'expires_in' => 3600,
        ]),
    ]);

    $connection = oneDriveConnection(['expires_at' => now()->subMinute()->timestamp]);

    $credentials = new OneDriveClient($connection)->credentials();

    expect($credentials['access_token'])->toBe('new-token')
        ->and($credentials['refresh_token'])->toBe('refresh-token');

    $connection->refresh();
    expect($connection->credentials['access_token'])->toBe('new-token')
        ->and($connection->credentials['refresh_token'])->toBe('refresh-token');
});

it('fails before http when refresh token is missing', function () {
    Http::preventStrayRequests();
    $connection = oneDriveConnection([
        'refresh_token' => null,
        'expires_at' => now()->subMinute()->timestamp,
    ]);

    expect(fn () => new OneDriveClient($connection)->credentials())
        ->toThrow(OneDriveException::class, 'OneDrive refresh token is missing.');
});

it('encodes graph path segments safely', function () {
    $connection = oneDriveConnection();
    $client = new OneDriveClient($connection);

    expect($client->childrenUrl('Folder A/#hash & %.txt'))
        ->toBe('https://graph.microsoft.com/v1.0/me/drive/root:/Folder%20A/%23hash%20%26%20%25.txt:/children')
        ->and($client->childrenUrl(''))->toBe('https://graph.microsoft.com/v1.0/me/drive/root/children');
});

it('lists children through graph', function () {
    Http::preventStrayRequests();
    Http::fake([
        'https://graph.microsoft.com/v1.0/me/drive/root:/Folder:/children' => Http::response([
            'value' => [['id' => '1', 'name' => 'doc.txt', 'file' => ['mimeType' => 'text/plain'], 'size' => 12]],
        ]),
    ]);

    $items = new OneDriveClient(oneDriveConnection())->listChildren('Folder');

    expect($items)->toHaveCount(1)->and($items[0]['name'])->toBe('doc.txt');
});

it('gets item metadata through graph and returns null for missing items', function () {
    Http::preventStrayRequests();
    Http::fake([
        'https://graph.microsoft.com/v1.0/me/drive/root:/doc.txt' => Http::response(['id' => '1', 'name' => 'doc.txt', 'file' => []]),
        'https://graph.microsoft.com/v1.0/me/drive/root:/missing.txt' => Http::response([], 404),
    ]);

    $client = new OneDriveClient(oneDriveConnection());

    expect($client->item('doc.txt')['name'])->toBe('doc.txt')
        ->and($client->item('missing.txt'))->toBeNull();
});

it('downloads and uploads content through graph', function () {
    Http::preventStrayRequests();
    Http::fake([
        'https://graph.microsoft.com/v1.0/me/drive/root:/doc.txt:/content' => Http::sequence()
            ->push('hello')
            ->push([], 201),
    ]);

    $client = new OneDriveClient(oneDriveConnection());

    expect($client->download('doc.txt'))->toBe('hello');
    $client->upload('doc.txt', 'updated');

    Http::assertSentCount(2);
});

it('downloads streams from response body once', function () {
    Http::preventStrayRequests();
    Http::fake([
        'https://graph.microsoft.com/v1.0/me/drive/root:/doc.txt:/content' => Http::response('hello'),
    ]);

    $stream = new OneDriveClient(oneDriveConnection())->downloadStream('doc.txt');

    expect(stream_get_contents($stream))->toBe('hello');

    Http::assertSent(fn ($request): bool => $request->method() === 'GET'
        && $request->url() === 'https://graph.microsoft.com/v1.0/me/drive/root:/doc.txt:/content'
        && $request->hasHeader('Authorization', BEARER_FRESH_TOKEN));
});

it('uploads empty streams with simple upload instead of an invalid content range', function () {
    Http::preventStrayRequests();
    Http::fake([
        'https://graph.microsoft.com/v1.0/me/drive/root:/empty.txt:/content' => Http::response([], 201),
    ]);

    $stream = fopen('php://temp', 'r+');

    new OneDriveClient(oneDriveConnection())->uploadStream('empty.txt', $stream);

    Http::assertSentCount(1);
    Http::assertSent(fn ($request): bool => $request->method() === 'PUT'
        && $request->url() === 'https://graph.microsoft.com/v1.0/me/drive/root:/empty.txt:/content'
        && $request->hasHeader('Authorization', BEARER_FRESH_TOKEN)
        && $request->body() === '');
});

it('creates upload sessions and uploads chunks until terminal completion', function () {
    Http::preventStrayRequests();
    Http::fake([
        'https://graph.microsoft.com/v1.0/me/drive/root:/big.bin:/createUploadSession' => Http::response([
            'uploadUrl' => UPLOAD_SESSION_URL,
        ]),
        UPLOAD_SESSION_URL => Http::sequence()
            ->push(['nextExpectedRanges' => ['5242880-']], 202)
            ->push(['id' => 'uploaded-item'], 201),
    ]);

    $stream = fopen('php://temp', 'r+');
    fwrite($stream, str_repeat('a', 5 * 1024 * 1024).str_repeat('b', 3));
    rewind($stream);

    new OneDriveClient(oneDriveConnection())->uploadStream('big.bin', $stream);

    Http::assertSentCount(3);
    Http::assertSent(fn ($request): bool => $request->method() === 'POST'
        && $request->url() === 'https://graph.microsoft.com/v1.0/me/drive/root:/big.bin:/createUploadSession'
        && $request->hasHeader('Authorization', BEARER_FRESH_TOKEN)
        && $request['item']['@microsoft.graph.conflictBehavior'] === 'replace');
    Http::assertSent(fn ($request): bool => $request->method() === 'PUT'
        && $request->url() === UPLOAD_SESSION_URL
        && $request->hasHeader('Content-Length', (string) (5 * 1024 * 1024))
        && $request->hasHeader('Content-Range', 'bytes 0-5242879/5242883')
        && $request->body() === str_repeat('a', 5 * 1024 * 1024));
    Http::assertSent(fn ($request): bool => $request->method() === 'PUT'
        && $request->url() === UPLOAD_SESSION_URL
        && $request->hasHeader('Content-Length', '3')
        && $request->hasHeader('Content-Range', 'bytes 5242880-5242882/5242883')
        && $request->body() === 'bbb');
});

it('deletes and creates folders through graph', function () {
    Http::preventStrayRequests();
    Http::fake([
        'https://graph.microsoft.com/v1.0/me/drive/root:/old.txt' => Http::response([], 204),
        'https://graph.microsoft.com/v1.0/me/drive/root:/Parent:/children' => Http::response(['id' => 'new-folder'], 201),
    ]);

    $client = new OneDriveClient(oneDriveConnection());
    $client->delete('old.txt');
    $client->createFolder('Parent/New Folder');

    Http::assertSentCount(2);
    Http::assertSent(fn ($request): bool => $request->method() === 'DELETE'
        && $request->url() === 'https://graph.microsoft.com/v1.0/me/drive/root:/old.txt'
        && $request->hasHeader('Authorization', BEARER_FRESH_TOKEN));
    Http::assertSent(fn ($request): bool => $request->method() === 'POST'
        && $request->url() === 'https://graph.microsoft.com/v1.0/me/drive/root:/Parent:/children'
        && $request->hasHeader('Authorization', BEARER_FRESH_TOKEN)
        && $request['name'] === 'New Folder'
        && $request['folder'] === []
        && $request['@microsoft.graph.conflictBehavior'] === 'fail');
});

it('rejects empty or ambiguous destination paths before graph requests', function (string $path) {
    Http::preventStrayRequests();

    expect(fn () => new OneDriveClient(oneDriveConnection())->move(SOURCE_DOC_PATH, $path))
        ->toThrow(InvalidArgumentException::class, 'OneDrive destination path must include a file or folder name.');
})->with([
    'empty' => '',
    'root' => '/',
    'trailing slash' => 'Parent/',
    'trailing slash with whitespace' => 'Parent/ ',
]);

it('moves files through graph', function () {
    Http::preventStrayRequests();
    Http::fake([
        'https://graph.microsoft.com/v1.0/me/drive/root:/Target' => Http::response(['id' => 'target-id', 'folder' => []]),
        'https://graph.microsoft.com/v1.0/me/drive/root:/Source/doc.txt' => Http::response(['id' => 'moved'], 200),
    ]);

    new OneDriveClient(oneDriveConnection())->move(SOURCE_DOC_PATH, TARGET_DOC_PATH);

    Http::assertSentCount(2);
    Http::assertSent(fn ($request): bool => $request->method() === 'GET'
        && $request->url() === 'https://graph.microsoft.com/v1.0/me/drive/root:/Target'
        && $request->hasHeader('Authorization', BEARER_FRESH_TOKEN));
    Http::assertSent(fn ($request): bool => $request->method() === 'PATCH'
        && $request->url() === 'https://graph.microsoft.com/v1.0/me/drive/root:/Source/doc.txt'
        && $request->hasHeader('Authorization', BEARER_FRESH_TOKEN)
        && $request['name'] === 'doc2.txt'
        && $request['parentReference']['id'] === 'target-id');
});

it('rejects move destinations whose parent is missing or not a folder', function (array $parentItem, string $message) {
    Http::preventStrayRequests();
    Http::fake([
        'https://graph.microsoft.com/v1.0/me/drive/root:/Target' => Http::response($parentItem),
    ]);

    expect(fn () => new OneDriveClient(oneDriveConnection())->move(SOURCE_DOC_PATH, TARGET_DOC_PATH))
        ->toThrow(OneDriveException::class, $message);
})->with([
    'missing id' => [['folder' => []], 'OneDrive move destination parent is missing an id.'],
    'not folder' => [['id' => 'target-id', 'file' => []], 'OneDrive move destination parent is not a folder.'],
]);

it('copies files and polls monitor url', function () {
    Http::preventStrayRequests();
    Http::fake([
        'https://graph.microsoft.com/v1.0/me/drive/root:/Target' => Http::response(['id' => 'target-id', 'folder' => []]),
        'https://graph.microsoft.com/v1.0/me/drive/root:/Source/doc.txt:/copy' => Http::response('', 202, ['Location' => 'https://monitor.example/copy']),
        'https://monitor.example/copy' => Http::sequence()
            ->push(['status' => 'notStarted'], 200)
            ->push(['status' => 'inProgress'], 200)
            ->push(['status' => 'completed'], 200),
    ]);

    new OneDriveClient(oneDriveConnection())->copy(SOURCE_DOC_PATH, TARGET_DOC_PATH);

    Http::assertSentCount(5);
    Http::assertSent(fn ($request): bool => $request->method() === 'GET'
        && $request->url() === 'https://graph.microsoft.com/v1.0/me/drive/root:/Target'
        && $request->hasHeader('Authorization', BEARER_FRESH_TOKEN));
    Http::assertSent(fn ($request): bool => $request->method() === 'POST'
        && $request->url() === 'https://graph.microsoft.com/v1.0/me/drive/root:/Source/doc.txt:/copy'
        && $request->hasHeader('Authorization', BEARER_FRESH_TOKEN)
        && $request['name'] === 'doc2.txt'
        && $request['parentReference']['id'] === 'target-id');
});

it('rejects copy destinations whose parent is missing or not a folder', function (array $parentItem, string $message) {
    Http::preventStrayRequests();
    Http::fake([
        'https://graph.microsoft.com/v1.0/me/drive/root:/Target' => Http::response($parentItem),
    ]);

    expect(fn () => new OneDriveClient(oneDriveConnection())->copy(SOURCE_DOC_PATH, TARGET_DOC_PATH))
        ->toThrow(OneDriveException::class, $message);
})->with([
    'missing id' => [['folder' => []], 'OneDrive copy destination parent is missing an id.'],
    'not folder' => [['id' => 'target-id', 'file' => []], 'OneDrive copy destination parent is not a folder.'],
]);

it('uses enum constants consistently for onedrive connections', function () {
    expect(CloudProvider::ONEDRIVE->value)->toBe(2)
        ->and(oneDriveConnection()->provider === CloudProvider::ONEDRIVE)->toBeTrue();
});
