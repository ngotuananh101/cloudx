<?php

use App\Models\CloudConnection;
use App\Services\OneDrive\OneDriveClient;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

uses(TestCase::class);

it('downloadStream does not require loading the entire body via download()', function () {
    Http::fake([
        'https://graph.microsoft.com/v1.0/me/drive/root:/path/to/file.bin:/content' => Http::response('chunk-a-chunk-b', 200, [
            'Content-Type' => 'application/octet-stream',
        ]),
    ]);

    $connection = new CloudConnection;
    $connection->credentials = [
        'access_token' => 'fake_token',
        'refresh_token' => 'fake_refresh',
        'expires_at' => now()->addMinutes(10)->timestamp,
    ];

    $client = new OneDriveClient($connection);

    $stream = $client->downloadStream('path/to/file.bin');

    expect(is_resource($stream))->toBeTrue()
        ->and(stream_get_contents($stream))->toBe('chunk-a-chunk-b');
});
