<?php

namespace App\Http\Controllers;

use App\Enums\ActivityAction;
use App\Enums\CloudProvider;
use App\Enums\ConnectionStatus;
use App\Http\Requests\StoreS3ConnectionRequest;
use App\Http\Requests\UpdateS3ConnectionRequest;
use App\Models\CloudConnection;
use App\Services\ActivityLogger;
use App\Services\CloudStorage\Connectors\S3Connector;
use App\Services\CloudStorage\HostAddressGuard;
use Illuminate\Http\RedirectResponse;
use Illuminate\Validation\ValidationException;
use Throwable;

class S3ConnectionController extends Controller
{
    public function __construct(
        private S3Connector $connector,
        private ActivityLogger $activityLogger,
        private HostAddressGuard $hostAddressGuard,
    ) {}

    public function store(StoreS3ConnectionRequest $request): RedirectResponse
    {
        $validated = $request->validated();
        $resolvedIp = $this->assertEndpointHostAllowed($validated['endpoint'] ?? null);
        $credentials = $this->credentialsFromValidated($validated, [], $resolvedIp);

        $this->testConnection($credentials);

        $connection = $request->user()->cloudConnections()->create([
            'name' => $validated['name'],
            'provider' => CloudProvider::AWS_S3,
            'provider_id' => $this->providerId($credentials),
            'credentials' => $credentials,
            'status' => ConnectionStatus::CONNECTED,
            'total_space' => null,
            'used_space' => null,
            'error_message' => null,
            'last_synced_at' => now(),
        ]);

        $this->activityLogger->log(
            user: $request->user(),
            action: ActivityAction::ConnectionCreated,
            subjectName: $connection->name,
            connection: $connection,
        );

        return redirect()->route('dashboard')->with('success', 'Successfully connected to AWS S3!');
    }

    public function update(UpdateS3ConnectionRequest $request, CloudConnection $connection): RedirectResponse
    {
        if ($connection->user_id !== $request->user()->id) {
            abort(403, 'Unauthorized action.');
        }

        if ($connection->provider !== CloudProvider::AWS_S3) {
            abort(404);
        }

        $validated = $request->validated();
        $resolvedIp = $this->assertEndpointHostAllowed($validated['endpoint'] ?? null);
        $credentials = $this->credentialsFromValidated($validated, $connection->credentials, $resolvedIp);

        $this->testConnection($credentials);

        $connection->update([
            'name' => $validated['name'],
            'provider' => CloudProvider::AWS_S3,
            'provider_id' => $this->providerId($credentials),
            'credentials' => $credentials,
            'status' => ConnectionStatus::CONNECTED,
            'total_space' => null,
            'used_space' => null,
            'error_message' => null,
            'last_synced_at' => now(),
        ]);

        return redirect()->route('dashboard')->with('success', 'AWS S3 connection updated.');
    }

    private function assertEndpointHostAllowed(mixed $endpoint): ?string
    {
        if (! is_string($endpoint) || trim($endpoint) === '') {
            return null;
        }

        $host = parse_url($endpoint, PHP_URL_HOST);

        if (! is_string($host) || $host === '') {
            throw ValidationException::withMessages([
                'endpoint' => 'S3 endpoint must include a valid host.',
            ]);
        }

        $this->hostAddressGuard->assertConnectionHostAllowed($host, 'endpoint');

        return $this->hostAddressGuard->resolveAllowedIp($host);
    }

    /**
     * @param  array<string, mixed>  $validated
     * @param  array<string, mixed>  $existingCredentials
     * @return array<string, mixed>
     */
    private function credentialsFromValidated(array $validated, array $existingCredentials = [], ?string $resolvedIp = null): array
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
            'resolved_ip' => $resolvedIp,
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
