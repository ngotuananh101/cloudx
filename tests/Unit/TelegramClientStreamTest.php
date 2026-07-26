<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Exceptions\PythonServiceException;
use App\Exceptions\TelegramServiceException;
use App\Services\Telegram\TelegramClient;
use GuzzleHttp\Promise\Create;
use GuzzleHttp\Psr7\Response;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Http;
use Psr\Http\Message\StreamInterface;
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

        $this->expectException(PythonServiceException::class);
        $this->expectExceptionMessage('Python service error: HTTP 500');

        $client->downloadStream(1234);
    }

    public function test_download_stream_fallback(): void
    {
        Http::fake([
            'https://telegram.local/read?message_id=1234' => function () {
                $stream = new class('fallback-content') implements StreamInterface
                {
                    private $resource;

                    public function __construct(string $content)
                    {
                        $this->resource = fopen('php://temp', 'r+');
                        fwrite($this->resource, $content);
                        rewind($this->resource);
                    }

                    public function __toString(): string
                    {
                        return '';
                    }

                    public function close(): void {}

                    public function detach()
                    {
                        return null;
                    }

                    public function getSize(): ?int
                    {
                        return null;
                    }

                    public function tell(): int
                    {
                        return ftell($this->resource);
                    }

                    public function eof(): bool
                    {
                        return feof($this->resource);
                    }

                    public function isSeekable(): bool
                    {
                        return true;
                    }

                    public function seek($offset, $whence = SEEK_SET): void
                    {
                        fseek($this->resource, $offset, $whence);
                    }

                    public function rewind(): void
                    {
                        rewind($this->resource);
                    }

                    public function isWritable(): bool
                    {
                        return false;
                    }

                    public function write($string): int
                    {
                        return 0;
                    }

                    public function isReadable(): bool
                    {
                        return true;
                    }

                    public function read($length): string
                    {
                        return fread($this->resource, $length);
                    }

                    public function getContents(): string
                    {
                        return stream_get_contents($this->resource);
                    }

                    public function getMetadata($key = null)
                    {
                        return null;
                    }
                };

                return Create::promiseFor(
                    new Response(200, [], $stream)
                );
            },
        ]);

        $client = new TelegramClient('https://telegram.local', 'fake-token', 'fake-session');
        $stream = $client->downloadStream(1234);

        $this->assertIsResource($stream);
        $this->assertEquals('fallback-content', stream_get_contents($stream));
    }
}
