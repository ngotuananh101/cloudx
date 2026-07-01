<?php

use App\Exceptions\PythonServiceException;
use App\Services\Python\PythonServiceClient;
use Illuminate\Support\Facades\Http;

const PY_BASE_URL = 'http://localhost:8000';
const PROBE_URI = '/probe';
const PY_TEST_TOKEN = 'test-token';

beforeEach(function () {
    config(['services.python-service.url' => PY_BASE_URL]);
    config(['services.python-service.token' => PY_TEST_TOKEN]);
});

it('sends the X-Token header on every request', function () {
    Http::fake([
        'http://localhost:8000/probe' => Http::response(['ok' => true]),
    ]);

    $client = new class(PY_BASE_URL, PY_TEST_TOKEN) extends PythonServiceClient
    {
        public function probe(): array
        {
            return $this->post(PROBE_URI, [])->json();
        }
    };

    expect($client->probe())->toBe(['ok' => true]);

    Http::assertSent(function ($request) {
        return $request->url() === 'http://localhost:8000/probe'
            && $request->hasHeader('X-Token', PY_TEST_TOKEN);
    });
});

it('throws on 403 auth failure', function () {
    Http::fake([
        'http://localhost:8000/probe' => Http::response(['error' => 'forbidden'], 403),
    ]);

    $client = new class(PY_BASE_URL, PY_TEST_TOKEN) extends PythonServiceClient
    {
        public function probe(): void
        {
            $this->post(PROBE_URI, []);
        }
    };

    expect(fn () => $client->probe())->toThrow(PythonServiceException::class, 'Python service authentication failed.');
});

it('throws on 5xx failure', function () {
    Http::fake([
        'http://localhost:8000/probe' => Http::response(['error' => 'boom'], 500),
    ]);

    $client = new class(PY_BASE_URL, PY_TEST_TOKEN) extends PythonServiceClient
    {
        public function probe(): void
        {
            $this->post(PROBE_URI, []);
        }
    };

    expect(fn () => $client->probe())->toThrow(PythonServiceException::class);
});

it('exposes url and token', function () {
    $client = new PythonServiceClient(PY_BASE_URL, 'abc');

    expect($client->url())->toBe(PY_BASE_URL)
        ->and($client->token())->toBe('abc');
});

it('normalizes trailing slashes from the base url', function () {
    $client = new PythonServiceClient('http://localhost:8000/', 'abc');

    expect($client->url())->toBe(PY_BASE_URL);
});

it('rejects missing or schemeless base urls before sending requests', function (?string $url) {
    expect(fn () => new PythonServiceClient((string) $url, 'abc'))
        ->toThrow(PythonServiceException::class, 'Python service URL must include http:// or https://.');
})->with([
    'empty string' => '',
    'schemeless host' => 'localhost:8000',
    'relative path' => '/sync',
]);
