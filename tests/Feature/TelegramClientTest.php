<?php

use App\Services\Telegram\TelegramClient;
use Illuminate\Support\Facades\Http;

it('sends correct headers on all requests', function () {
    Http::preventStrayRequests();
    Http::fake([
        '*/auth-status' => Http::response(['authorized' => true]),
    ]);

    $client = new TelegramClient('http://microservice:8000', 'test-token', 'sess1');
    $client->isAuthorized();

    Http::assertSent(fn ($request): bool => $request->hasHeader('X-Session-Id', 'sess1')
        && $request->hasHeader('X-Token', 'test-token')
    );
});

it('returns authorized status', function () {
    Http::preventStrayRequests();
    Http::fake(['*/auth-status' => Http::response(['authorized' => true])]);

    $client = new TelegramClient('http://microservice:8000', 'token', 'sess1');

    expect($client->isAuthorized())->toBeTrue();
});

it('returns unauthorized status', function () {
    Http::preventStrayRequests();
    Http::fake(['*/auth-status' => Http::response(['authorized' => false])]);

    $client = new TelegramClient('http://microservice:8000', 'token', 'sess1');

    expect($client->isAuthorized())->toBeFalse();
});

it('uploads file and returns message_id', function () {
    Http::preventStrayRequests();
    Http::fake([
        '*/write' => Http::response(['success' => true, 'message_id' => 12345], 200),
    ]);

    $client = new TelegramClient('http://microservice:8000', 'token', 'sess1');
    $messageId = $client->upload('test.txt', 'hello world');

    expect($messageId)->toBe(12345);

    Http::assertSent(fn ($request): bool => $request->method() === 'POST'
        && str_contains($request->url(), '/write')
    );
});

it('uploads stream and returns message_id', function () {
    Http::preventStrayRequests();
    Http::fake([
        '*/write' => Http::response(['success' => true, 'message_id' => 67890], 200),
    ]);

    $stream = fopen('php://temp', 'r+');
    fwrite($stream, 'stream content');
    rewind($stream);

    $client = new TelegramClient('http://microservice:8000', 'token', 'sess1');
    $messageId = $client->uploadStream('stream.txt', $stream);

    expect($messageId)->toBe(67890);
});

it('downloads file as string', function () {
    Http::preventStrayRequests();
    Http::fake([
        '*/read*' => Http::response('file contents', 200, ['Content-Type' => 'text/plain']),
    ]);

    $client = new TelegramClient('http://microservice:8000', 'token', 'sess1');
    $result = $client->download(12345);

    expect($result)->toBe('file contents');

    Http::assertSent(fn ($request): bool => $request->method() === 'GET'
        && str_contains($request->url(), '/read')
        && str_contains($request->url(), 'message_id=12345')
    );
});

it('downloads file as stream', function () {
    Http::preventStrayRequests();
    Http::fake([
        '*/read*' => Http::response('stream data', 200),
    ]);

    $client = new TelegramClient('http://microservice:8000', 'token', 'sess1');
    $stream = $client->downloadStream(12345);

    expect(is_resource($stream))->toBeTrue()
        ->and(stream_get_contents($stream))->toBe('stream data');
});

it('deletes file by message_id', function () {
    Http::preventStrayRequests();
    Http::fake([
        '*/delete*' => Http::response(['success' => true]),
    ]);

    $client = new TelegramClient('http://microservice:8000', 'token', 'sess1');
    $client->delete(12345);

    Http::assertSent(fn ($request): bool => $request->method() === 'DELETE'
        && str_contains($request->url(), '/delete')
        && str_contains($request->url(), 'message_id=12345')
    );
});

it('gets file metadata', function () {
    Http::preventStrayRequests();
    Http::fake([
        '*/metadata*' => Http::response([
            'message_id' => 12345,
            'original_name' => 'test.txt',
            'size' => 100,
            'mime_type' => 'text/plain',
            'caption' => 'test.txt',
            'created_at' => '2026-01-01T00:00:00',
            'updated_at' => '2026-01-01T00:00:00',
        ]),
    ]);

    $client = new TelegramClient('http://microservice:8000', 'token', 'sess1');
    $meta = $client->metadata(12345);

    expect($meta)->toBeArray()
        ->and($meta['message_id'])->toBe(12345)
        ->and($meta['original_name'])->toBe('test.txt')
        ->and($meta['size'])->toBe(100);
});

it('returns null metadata for missing file', function () {
    Http::preventStrayRequests();
    Http::fake([
        '*/metadata*' => Http::response(['detail' => 'File not found'], 404),
    ]);

    $client = new TelegramClient('http://microservice:8000', 'token', 'sess1');
    $meta = $client->metadata(99999);

    expect($meta)->toBeNull();
});

it('lists files with pagination', function () {
    Http::preventStrayRequests();
    Http::fake([
        '*/list*' => Http::response([
            'total' => 2,
            'limit' => 100,
            'offset' => 0,
            'files' => [
                ['message_id' => 1, 'original_name' => 'a.txt', 'size' => 10, 'mime_type' => 'text/plain', 'caption' => 'a.txt', 'created_at' => '2026-01-01T00:00:00'],
                ['message_id' => 2, 'original_name' => 'b.txt', 'size' => 20, 'mime_type' => 'text/plain', 'caption' => 'b.txt', 'created_at' => '2026-01-02T00:00:00'],
            ],
        ]),
    ]);

    $client = new TelegramClient('http://microservice:8000', 'token', 'sess1');
    $result = $client->listAll(100, 0);

    expect($result['total'])->toBe(2)
        ->and($result['files'])->toHaveCount(2)
        ->and($result['files'][0]['message_id'])->toBe(1);
});

it('syncs and returns added count', function () {
    Http::preventStrayRequests();
    Http::fake([
        '*/sync' => Http::response(['success' => true, 'added' => 5]),
    ]);

    $client = new TelegramClient('http://microservice:8000', 'token', 'sess1');
    $added = $client->sync();

    expect($added)->toBe(5);
});

it('throws on 403 responses', function () {
    Http::preventStrayRequests();
    Http::fake([
        '*/auth-status' => Http::response(['detail' => 'Invalid API Token'], 403),
    ]);

    $client = new TelegramClient('http://microservice:8000', 'token', 'sess1');

    expect(fn () => $client->isAuthorized())->toThrow(RuntimeException::class, 'Telegram storage API authentication failed.');
});

it('throws on unexpected errors', function () {
    Http::preventStrayRequests();
    Http::fake([
        '*/read*' => Http::response(['detail' => 'Internal error'], 500),
    ]);

    $client = new TelegramClient('http://microservice:8000', 'token', 'sess1');

    expect(fn () => $client->download(12345))->toThrow(RuntimeException::class);
});
