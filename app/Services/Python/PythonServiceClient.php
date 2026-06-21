<?php

declare(strict_types=1);

namespace App\Services\Python;

use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use RuntimeException;

class PythonServiceClient
{
    public function __construct(
        private readonly string $url,
        private readonly string $token,
    ) {}

    public function url(): string
    {
        return $this->url;
    }

    public function token(): string
    {
        return $this->token;
    }

    protected function request(int $timeout = 30): PendingRequest
    {
        return Http::connectTimeout(5)
            ->timeout($timeout)
            ->withHeaders(['X-Token' => $this->token]);
    }

    protected function post(string $path, array $body, int $timeout = 30): Response
    {
        $response = $this->request($timeout)->asJson()->post($this->url.$path, $body);

        $this->assertSuccess($response);

        return $response;
    }

    /**
     * @return Response
     */
    protected function postStream(string $path, array $body, int $timeout = 30): Response
    {
        $response = $this->request($timeout)->withOptions(['stream' => true])->asJson()->post($this->url.$path, $body);

        $this->assertSuccess($response);

        return $response;
    }

    protected function get(string $path, array $query = [], int $timeout = 30): Response
    {
        $response = $this->request($timeout)->get($this->url.$path, $query);

        $this->assertSuccess($response);

        return $response;
    }

    protected function assertAuthenticated(Response $response): void
    {
        if ($response->status() === 403) {
            throw new RuntimeException('Python service authentication failed.');
        }
    }

    protected function assertSuccess(Response $response): void
    {
        $this->assertAuthenticated($response);

        if ($response->failed()) {
            throw new RuntimeException('Python service error: '.$response->body());
        }
    }
}
