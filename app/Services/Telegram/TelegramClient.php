<?php

declare(strict_types=1);

namespace App\Services\Telegram;

use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use RuntimeException;

class TelegramClient
{
    public function __construct(
        private readonly string $url,
        private readonly string $token,
        private readonly string $sessionId,
    ) {}

    public function isAuthorized(): bool
    {
        $response = $this->request()->get($this->url.'/auth-status');

        $this->assertAuthenticated($response);

        return (bool) ($response->json('authorized') ?? false);
    }

    /**
     * @return int message_id
     */
    public function upload(string $filename, string $contents): int
    {
        $response = $this->request()
            ->attach('file', $contents, $filename)
            ->post($this->url.'/write');

        $this->assertSuccess($response);

        return (int) $response->json('message_id');
    }

    /**
     * @param  resource  $stream
     * @return int message_id
     */
    public function uploadStream(string $filename, $stream): int
    {
        $response = $this->request()
            ->attach('file', $stream, $filename)
            ->post($this->url.'/write');

        $this->assertSuccess($response);

        return (int) $response->json('message_id');
    }

    public function download(int $messageId): string
    {
        $response = $this->request()
            ->withQueryParameters(['message_id' => $messageId])
            ->get($this->url.'/read');

        $this->assertAuthenticated($response);

        if ($response->status() === 404) {
            throw new RuntimeException('Telegram file not found.');
        }

        if ($response->failed()) {
            throw new RuntimeException('Telegram storage API error: '.$response->body());
        }

        return $response->body();
    }

    /**
     * @return resource
     */
    public function downloadStream(int $messageId)
    {
        $body = $this->download($messageId);

        $stream = fopen('php://temp', 'r+');

        if ($stream === false) {
            throw new RuntimeException('Could not create download stream.');
        }

        fwrite($stream, $body);
        rewind($stream);

        return $stream;
    }

    public function delete(int $messageId): void
    {
        $response = $this->request()
            ->withQueryParameters(['message_id' => $messageId])
            ->delete($this->url.'/delete');

        $this->assertAuthenticated($response);

        if ($response->status() === 404) {
            throw new RuntimeException('Telegram file not found.');
        }

        $response->throw();
    }

    /**
     * @return array<string, mixed>|null
     */
    public function metadata(int $messageId): ?array
    {
        $response = $this->request()
            ->withQueryParameters(['message_id' => $messageId])
            ->get($this->url.'/metadata');

        $this->assertAuthenticated($response);

        if ($response->status() === 404) {
            return null;
        }

        $response->throw();

        $data = $response->json();

        return is_array($data) ? $data : null;
    }

    /**
     * @return array{total: int, limit: int, offset: int, files: array<int, array<string, mixed>>}
     */
    public function listAll(int $limit = 100, int $offset = 0): array
    {
        $response = $this->request()
            ->withQueryParameters(['limit' => $limit, 'offset' => $offset])
            ->get($this->url.'/list');

        $this->assertAuthenticated($response);
        $response->throw();

        return $response->json();
    }

    public function sync(): int
    {
        $response = $this->request()->post($this->url.'/sync');

        $this->assertAuthenticated($response);
        $response->throw();

        return (int) ($response->json('added') ?? 0);
    }

    private function request(): PendingRequest
    {
        return Http::connectTimeout(5)
            ->timeout(30)
            ->withHeaders([
                'X-Session-Id' => $this->sessionId,
                'X-Token' => $this->token,
            ]);
    }

    private function assertAuthenticated(Response $response): void
    {
        if ($response->status() === 403) {
            throw new RuntimeException('Telegram storage API authentication failed.');
        }
    }

    private function assertSuccess(Response $response): void
    {
        $this->assertAuthenticated($response);

        if ($response->failed()) {
            throw new RuntimeException('Telegram storage API error: '.$response->body());
        }
    }
}
