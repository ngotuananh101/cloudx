<?php

declare(strict_types=1);

namespace App\Services\Python;

use App\Exceptions\PythonServiceException;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;

class PythonServiceClient
{
    private readonly string $baseUrl;

    public function __construct(
        string $url,
        private readonly string $token,
    ) {
        $this->baseUrl = $this->normalizeBaseUrl($url);
    }

    public function url(): string
    {
        return $this->baseUrl;
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
        $response = $this->request($timeout)->asJson()->post($this->baseUrl.$path, $body);

        $this->assertSuccess($response);

        return $response;
    }

    protected function postStream(string $path, array $body, int $timeout = 30): Response
    {
        $response = $this->request($timeout)->withOptions(['stream' => true])->asJson()->post($this->baseUrl.$path, $body);

        $this->assertSuccess($response);

        return $response;
    }

    protected function get(string $path, array $query = [], int $timeout = 30): Response
    {
        $response = $this->request($timeout)->get($this->baseUrl.$path, $query);

        $this->assertSuccess($response);

        return $response;
    }

    protected function assertAuthenticated(Response $response): void
    {
        if ($response->status() === 403) {
            throw new PythonServiceException('Python service authentication failed.');
        }
    }

    protected function assertSuccess(Response $response): void
    {
        $this->assertAuthenticated($response);

        if ($response->failed()) {
            throw new PythonServiceException('Python service error: '.$response->body());
        }
    }

    private function normalizeBaseUrl(string $url): string
    {
        $baseUrl = rtrim(trim($url), '/');
        $scheme = parse_url($baseUrl, PHP_URL_SCHEME);

        if ($baseUrl === '' || ! in_array($scheme, ['http', 'https'], true)) {
            throw new PythonServiceException('Python service URL must include http:// or https://.');
        }

        return $baseUrl;
    }
}
