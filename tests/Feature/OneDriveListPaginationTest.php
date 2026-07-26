<?php

use App\Models\CloudConnection;
use App\Services\OneDrive\OneDriveClient;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Tests\TestCase;


test('it paginates over odata.nextLink correctly', function () {
    Http::fake([
        '*oauth2/v2.0/token' => Http::response(['access_token' => 'test_token', 'expires_in' => 3600]),
        '*/children' => Http::response([
            'value' => [['id' => 'item1'], ['id' => 'item2']],
            '@odata.nextLink' => 'https://graph.microsoft.com/v1.0/me/drive/root/children?skiptoken=page2',
        ]),
        '*skiptoken=page2' => Http::response([
            'value' => [['id' => 'item3']],
        ]),
    ]);

    $connection = CloudConnection::factory()->make([
        'credentials' => ['access_token' => 'test_token', 'expires_at' => now()->addHour()->timestamp],
    ]);

    $client = new OneDriveClient($connection);
    $items = $client->listChildren('/');

    expect($items)->toHaveCount(3)
        ->and($items[0]['id'])->toBe('item1')
        ->and($items[1]['id'])->toBe('item2')
        ->and($items[2]['id'])->toBe('item3');
});

test('it stops paginating when reaching safety cap and logs a warning', function () {
    Log::shouldReceive('warning')->once()->with('OneDrive listChildren reached max pages limit', Mockery::type('array'));

    Http::fake([
        '*oauth2/v2.0/token' => Http::response(['access_token' => 'test_token', 'expires_in' => 3600]),
        '*' => Http::response([
            'value' => [['id' => 'itemX']],
            '@odata.nextLink' => 'https://graph.microsoft.com/v1.0/me/drive/root/children?skiptoken=infinite',
        ]),
    ]);

    $connection = CloudConnection::factory()->make([
        'credentials' => ['access_token' => 'test_token', 'expires_at' => now()->addHour()->timestamp],
    ]);

    $client = new OneDriveClient($connection);
    $items = $client->listChildren('/');

    // 50 pages of 1 item each
    expect($items)->toHaveCount(50);
});
