<?php

use App\Services\Telegram\TelegramAdapter;
use App\Services\Telegram\TelegramClient;
use Illuminate\Support\Facades\Log;
use Tests\TestCase;

uses(TestCase::class);

test('it stops yielding items when reaching max list items cap and logs a warning', function () {
    $client = Mockery::mock(TelegramClient::class);

    // Simulate 2500 total items. Batch size is 100.
    // So 1st batch returns 100, 2nd batch returns 100...
    $client->shouldReceive('listAll')->andReturnUsing(function ($limit, $offset) {
        $files = [];
        for ($i = 0; $i < $limit; $i++) {
            $files[] = [
                'message_id' => $offset + $i,
                'created_at' => '2023-01-01 12:00:00',
                'size' => 1024,
                'mime_type' => 'text/plain',
                'original_name' => 'file'.($offset + $i).'.txt',
            ];
        }

        return [
            'total' => 2500,
            'files' => $files,
        ];
    });

    config(['cloud-storage.telegram.max_list_items' => 2000]);

    Log::shouldReceive('warning')->once()->with('Telegram listContents reached max limit', [
        'max' => 2000,
        'total_remote' => 2500,
    ]);

    $adapter = new TelegramAdapter($client);

    $yieldedCount = 0;
    foreach ($adapter->listContents('/', false) as $item) {
        $yieldedCount++;
    }

    expect($yieldedCount)->toBe(2000);
});
