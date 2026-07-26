<?php

use App\Services\Telegram\TelegramAdapter;
use App\Services\Telegram\TelegramClient;
use App\Support\CloudFileResponseFactory;
use Illuminate\Filesystem\FilesystemAdapter;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use League\Flysystem\Filesystem;

uses(RefreshDatabase::class);

it('calls metadata only once when using telegram adapter', function () {
    Http::fake([
        '*' => Http::response([
            'message_id' => 123,
            'size' => 1024,
            'mime_type' => 'text/plain',
            'original_name' => 'test.txt',
            'created_at' => '2023-01-01T00:00:00Z',
        ], 200),
    ]);

    $client = new TelegramClient('http://test', 'token', 'session');
    $adapter = new class($client) extends TelegramAdapter
    {
        public function __construct(TelegramClient $client)
        {
            parent::__construct($client);
        }
    };

    $disk = new FilesystemAdapter(new Filesystem($adapter), $adapter);

    $factory = new CloudFileResponseFactory;
    $meta = $factory->resolveMeta($disk, '123');

    expect($meta['name'])->toBe('test.txt')
        ->and($meta['mime'])->toBe('text/plain')
        ->and($meta['size'])->toBe(1024);

    Http::assertSentCount(1);
});
