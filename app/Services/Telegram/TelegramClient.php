<?php

declare(strict_types=1);

namespace App\Services\Telegram;

use App\Exceptions\TelegramServiceException;
use App\Services\Python\PythonServiceClient;
use Illuminate\Http\Client\PendingRequest;

class TelegramClient extends PythonServiceClient
{
    public function __construct(
        string $url,
        string $token,
        private readonly string $sessionId,
    ) {
        parent::__construct($url, $token);
    }

    protected function request(int $timeout = 30): PendingRequest
    {
        return parent::request($timeout)->withHeaders(['X-Session-Id' => $this->sessionId]);
    }

    public function isAuthorized(): bool
    {
        $response = $this->get('/auth-status');

        return (bool) ($response->json('authorized') ?? false);
    }

    /**
     * @return int message_id
     */
    public function upload(string $filename, string $contents): int
    {
        $response = $this->request()
            ->attach('file', $contents, $filename)
            ->post($this->url().'/write');

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
            ->post($this->url().'/write');

        return (int) $response->json('message_id');
    }

    public function download(int $messageId): string
    {
        $response = $this->request()
            ->withQueryParameters(['message_id' => $messageId])
            ->get($this->url().'/read');

        if ($response->status() === 404) {
            throw new TelegramServiceException('Telegram file not found.');
        }

        $this->assertSuccess($response);

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
            throw new TelegramServiceException('Could not create download stream.');
        }

        fwrite($stream, $body);
        rewind($stream);

        return $stream;
    }

    public function delete(int $messageId): void
    {
        $response = $this->request()
            ->withQueryParameters(['message_id' => $messageId])
            ->delete($this->url().'/delete');

        if ($response->status() === 404) {
            throw new TelegramServiceException('Telegram file not found.');
        }

        $this->assertSuccess($response);
    }

    /**
     * @return array<string, mixed>|null
     */
    public function metadata(int $messageId): ?array
    {
        $response = $this->request()
            ->withQueryParameters(['message_id' => $messageId])
            ->get($this->url().'/metadata');

        if ($response->status() === 404) {
            return null;
        }

        $this->assertSuccess($response);

        $data = $response->json();

        return is_array($data) ? $data : null;
    }

    /**
     * @return array{total: int, limit: int, offset: int, files: array<int, array<string, mixed>>}
     */
    public function listAll(int $limit = 100, int $offset = 0): array
    {
        $response = $this->get('/list', [
            'limit' => $limit,
            'offset' => $offset,
        ]);

        return $response->json();
    }

    public function sync(): int
    {
        return (int) ($this->post('/sync', [])->json('added') ?? 0);
    }

    /**
     * @return string phone_code_hash
     */
    public function sendCodeRequest(string $phone): string
    {
        $data = $this->post('/request-code', ['phone' => $phone])->json();

        if (! is_array($data) || ! isset($data['phone_code_hash'])) {
            throw new TelegramServiceException('Microservice did not return a phone code hash.');
        }

        return (string) $data['phone_code_hash'];
    }

    /**
     * @return array{success: bool, password_required: bool, message: string, synced: int}
     */
    public function login(string $phone, string $code, ?string $phoneCodeHash = null, ?string $password = null): array
    {
        $payload = [
            'phone' => $phone,
            'code' => $code,
        ];

        if ($phoneCodeHash !== null) {
            $payload['phone_code_hash'] = $phoneCodeHash;
        }

        if ($password !== null) {
            $payload['password'] = $password;
        }

        $data = $this->post('/login', $payload)->json();

        if (! is_array($data)) {
            return [
                'success' => false,
                'password_required' => false,
                'message' => 'Unexpected response from microservice.',
                'synced' => 0,
            ];
        }

        return [
            'success' => (bool) ($data['success'] ?? false),
            'password_required' => (bool) ($data['password_required'] ?? false),
            'message' => (string) ($data['message'] ?? ''),
            'synced' => (int) ($data['synced'] ?? 0),
        ];
    }
}
