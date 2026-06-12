<?php

namespace App\Http\Controllers;

use App\Enums\CloudProvider;
use App\Enums\ConnectionStatus;
use App\Http\Requests\StoreS3ConnectionRequest;
use App\Http\Requests\UpdateS3ConnectionRequest;
use App\Models\CloudConnection;
use App\Services\CloudStorage\Connectors\S3Connector;
use Illuminate\Http\RedirectResponse;
use Illuminate\Validation\ValidationException;
use Throwable;

class S3ConnectionController extends Controller
{
    public function __construct(private S3Connector $connector) {}

    public function store(StoreS3ConnectionRequest $request): RedirectResponse
    {
        $validated = $request->validated();
        $credentials = $this->credentialsFromValidated($validated);

        $this->testConnection($credentials);

        $request->user()->cloudConnections()->create([
            'name' => $validated['name'],
            'provider' => CloudProvider::AWS_S3(),
            'provider_id' => $this->providerId($credentials),
            'credentials' => $credentials,
            'status' => ConnectionStatus::CONNECTED(),
            'total_space' => null,
            'used_space' => null,
            'error_message' => null,
            'last_synced_at' => now(),
        ]);

        return redirect()->route('dashboard')->with('success', 'Successfully connected to AWS S3!');
    }

    public function update(UpdateS3ConnectionRequest $request, CloudConnection $connection): RedirectResponse
    {
        if ($connection->user_id !== $request->user()->id || ! $connection->provider->is(CloudProvider::AWS_S3)) {
            abort($connection->user_id !== $request->user()->id ? 403 : 404);
        }

        $validated = $request->validated();
        $credentials = $this->credentialsFromValidated($validated, $connection->credentials);

        $this->testConnection($credentials);

        $connection->update([
            'name' => $validated['name'],
            'provider' => CloudProvider::AWS_S3(),
            'provider_id' => $this->providerId($credentials),
            'credentials' => $credentials,
            'status' => ConnectionStatus::CONNECTED(),
            'total_space' => null,
            'used_space' => null,
            'error_message' => null,
            'last_synced_at' => now(),
        ]);

        return redirect()->route('dashboard')->with('success', 'AWS S3 connection updated.');
    }

    /**
     * @param  array<string, mixed>  $validated
     * @param  array<string, mixed>  $existingCredentials
     * @return array<string, mixed>
     */
    private function credentialsFromValidated(array $validated, array $existingCredentials = []): array
    {
        return array_filter([
            'provider_preset' => $validated['provider_preset'],
            'access_key_id' => $validated['access_key_id'],
            'secret_access_key' => filled($validated['secret_access_key'] ?? null)
                ? $validated['secret_access_key']
                : ($existingCredentials['secret_access_key'] ?? null),
            'region' => $validated['region'],
            'bucket' => $validated['bucket'],
            'endpoint' => $validated['endpoint'] ?? null,
            'use_path_style_endpoint' => (bool) ($validated['use_path_style_endpoint'] ?? false),
            'root' => $validated['root'] ?? '',
            'session_token' => $validated['session_token'] ?? null,
            'cdn_url' => $validated['cdn_url'] ?? null,
        ], static fn (mixed $value): bool => $value !== null);
    }

    /**
     * @param  array<string, mixed>  $credentials
     */
    private function testConnection(array $credentials): void
    {
        try {
            $this->connector->diskFromCredentials($credentials)->listContents('', false);
        } catch (Throwable $exception) {
            report($exception);

            throw ValidationException::withMessages([
                'bucket' => 'Could not connect to the S3 storage. Please check the bucket, region, endpoint, credentials, and connection settings.',
            ]);
        }
    }

    /**
     * @param  array<string, mixed>  $credentials
     */
    private function providerId(array $credentials): string
    {
        $providerPreset = $credentials['provider_preset'] ?? 'aws';
        $endpoint = $credentials['endpoint'] ?? 'aws';
        $root = ltrim((string) ($credentials['root'] ?? ''), '/');

        return sprintf('%s@%s/%s/%s', $credentials['bucket'], $providerPreset, $endpoint, $root);
    }
}
