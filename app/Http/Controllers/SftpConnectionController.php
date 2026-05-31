<?php

namespace App\Http\Controllers;

use App\Enums\CloudProvider;
use App\Enums\ConnectionStatus;
use App\Http\Requests\StoreSftpConnectionRequest;
use App\Http\Requests\UpdateSftpConnectionRequest;
use App\Models\CloudConnection;
use App\Services\CloudStorage\Connectors\SftpConnector;
use Illuminate\Http\RedirectResponse;
use Illuminate\Validation\ValidationException;
use Throwable;

class SftpConnectionController extends Controller
{
    public function __construct(private SftpConnector $connector) {}

    public function store(StoreSftpConnectionRequest $request): RedirectResponse
    {
        $validated = $request->validated();
        $credentials = $this->credentialsFromValidated($validated);

        $this->testConnection($credentials);

        $request->user()->cloudConnections()->create([
            'name' => $validated['name'],
            'provider' => CloudProvider::SFTP(),
            'provider_id' => $this->providerId($credentials),
            'credentials' => $credentials,
            'status' => ConnectionStatus::CONNECTED(),
            'total_space' => null,
            'used_space' => null,
            'error_message' => null,
            'last_synced_at' => now(),
        ]);

        return redirect()->route('dashboard')->with('success', 'Successfully connected to SFTP Server!');
    }

    public function update(UpdateSftpConnectionRequest $request, CloudConnection $connection): RedirectResponse
    {
        if ($connection->user_id !== $request->user()->id || ! $connection->provider->is(CloudProvider::SFTP)) {
            abort($connection->user_id !== $request->user()->id ? 403 : 404);
        }

        $validated = $request->validated();
        $credentials = $this->credentialsFromValidated($validated, $connection->credentials);

        $this->testConnection($credentials);

        $connection->update([
            'name' => $validated['name'],
            'provider' => CloudProvider::SFTP(),
            'provider_id' => $this->providerId($credentials),
            'credentials' => $credentials,
            'status' => ConnectionStatus::CONNECTED(),
            'total_space' => null,
            'used_space' => null,
            'error_message' => null,
            'last_synced_at' => now(),
        ]);

        return redirect()->route('dashboard')->with('success', 'SFTP connection updated.');
    }

    /**
     * @param  array<string, mixed>  $validated
     * @param  array<string, mixed>  $existingCredentials
     * @return array<string, mixed>
     */
    private function credentialsFromValidated(array $validated, array $existingCredentials = []): array
    {
        $password = filled($validated['password'] ?? null) ? $validated['password'] : ($existingCredentials['password'] ?? null);
        $privateKey = filled($validated['privateKey'] ?? null) ? $validated['privateKey'] : ($existingCredentials['privateKey'] ?? null);
        $passphrase = filled($validated['passphrase'] ?? null) ? $validated['passphrase'] : ($existingCredentials['passphrase'] ?? null);

        return array_filter([
            'host' => $validated['host'],
            'port' => (int) $validated['port'],
            'username' => $validated['username'],
            'password' => $password,
            'privateKey' => $privateKey,
            'passphrase' => $passphrase,
            'root' => $validated['root'] ?? '',
            'timeout' => isset($validated['timeout']) ? (int) $validated['timeout'] : null,
            'useAgent' => (bool) ($validated['useAgent'] ?? false),
            'hostFingerprint' => $validated['hostFingerprint'] ?? null,
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
                'host' => 'Could not connect to the SFTP server. Please check the host, port, credentials, and connection settings.',
            ]);
        }
    }

    /**
     * @param  array<string, mixed>  $credentials
     */
    private function providerId(array $credentials): string
    {
        return sprintf('%s@%s:%s/%s', $credentials['username'], $credentials['host'], $credentials['port'], ltrim((string) ($credentials['root'] ?? ''), '/'));
    }
}
