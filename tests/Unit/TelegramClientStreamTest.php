<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Exceptions\TelegramServiceException;
use App\Services\Telegram\TelegramClient;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class TelegramClientStreamTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Config::set('cloud-storage.telegram.download_timeout', 123);
    }

    public function test_download_stream_success(): void
    {
        Http::fake([
            'https://telegram.local/read?message_id=1234' => Http::response('fake-content', 200),
        ]);

        $client = new TelegramClient('https://telegram.local', 'fake-token', 'fake-session');
        $stream = $client->downloadStream(1234);

        $this->assertIsResource($stream);
        $this->assertEquals('fake-content', stream_get_contents($stream));
    }

    public function test_download_stream_404(): void
    {
        Http::fake([
            'https://telegram.local/read?message_id=1234' => Http::response('', 404),
        ]);

        $client = new TelegramClient('https://telegram.local', 'fake-token', 'fake-session');

        $this->expectException(TelegramServiceException::class);
        $this->expectExceptionMessage('Telegram file not found.');

        $client->downloadStream(1234);
    }

    public function test_download_stream_failed_status(): void
    {
        Http::fake([
            'https://telegram.local/read?message_id=1234' => Http::response('', 500),
        ]);

        $client = new TelegramClient('https://telegram.local', 'fake-token', 'fake-session');

        $this->expectException(TelegramServiceException::class);
        $this->expectExceptionMessage('Python service error: HTTP 500');

        $client->downloadStream(1234);
    }
}
