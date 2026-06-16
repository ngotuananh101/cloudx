<?php

use App\Services\Python\PythonServiceClient;
use Illuminate\Support\Facades\Http;
use RuntimeException;

beforeEach(function () {
    config(['services.python-service.url' => 'http://localhost:8000']);
    config(['services.python-service.token' => 'test-token']);
});

it('sends the X-Token header on every request', function () {
    Http::fake([
        'http://localhost:8000/probe' => Http::response(['ok' => true]),
    ]);

    $client = new class('http://localhost:8000', 'test-token') extends PythonServiceClient
    {
        public function probe(): array
        {
            return $this->post('/probe', [])->json();
        }
    };

    expect($client->probe())->toBe(['ok' => true]);

    Http::assertSent(function ($request) {
        return $request->url() === 'http://localhost:8000/probe'
            && $request->hasHeader('X-Token', 'test-token');
    });
});

it('throws on 403 auth failure', function () {
    Http::fake([
        'http://localhost:8000/probe' => Http::response(['error' => 'forbidden'], 403),
    ]);

    $client = new class('http://localhost:8000', 'test-token') extends PythonServiceClient
    {
        public function probe(): void
        {
            $this->post('/probe', []);
        }
    };

    expect(fn () => $client->probe())->toThrow(RuntimeException::class, 'Telegram storage API authentication failed.');
});

it('throws on 5xx failure', function () {
    Http::fake([
        'http://localhost:8000/probe' => Http::response(['error' => 'boom'], 500),
    ]);

    $client = new class('http://localhost:8000', 'test-token') extends PythonServiceClient
    {
        public function probe(): void
        {
            $this->post('/probe', []);
        }
    };

    expect(fn () => $client->probe())->toThrow(RuntimeException::class);
});

it('exposes url and token', function () {
    $client = new PythonServiceClient('http://localhost:8000', 'abc');

    expect($client->url())->toBe('http://localhost:8000')
        ->and($client->token())->toBe('abc');
});
