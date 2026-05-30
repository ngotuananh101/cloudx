<?php

namespace App\Http\Controllers;

use App\Enums\CloudProvider;
use App\Enums\ConnectionStatus;
use App\Http\Requests\StoreFtpConnectionRequest;
use App\Http\Requests\UpdateFtpConnectionRequest;
use App\Models\CloudConnection;
use App\Services\CloudStorage\Connectors\FtpConnector;
use Illuminate\Http\RedirectResponse;
use Illuminate\Validation\ValidationException;
use Throwable;

class FtpConnectionController extends Controller
{
    public function __construct(private FtpConnector $connector) {}

    public function store(StoreFtpConnectionRequest $request): RedirectResponse
    {
        $validated = $request->validated();
        $credentials = $this->credentialsFromValidated($validated);

        $this->testConnection($credentials);

        $request->user()->cloudConnections()->create([
            'name' => $validated['name'],
            'provider' => CloudProvider::FTP(),
            'provider_id' => $this->providerId($credentials),
            'credentials' => $credentials,
            'status' => ConnectionStatus::CONNECTED(),
            'total_space' => null,
            'used_space' => null,
            'error_message' => null,
            'last_synced_at' => now(),
        ]);

        return redirect()->route('dashboard')->with('success', 'Successfully connected to FTP Server!');
    }

    public function update(UpdateFtpConnectionRequest $request, CloudConnection $connection): RedirectResponse
    {
        if ($connection->user_id !== $request->user()->id || ! $connection->provider->is(CloudProvider::FTP)) {
            abort(403, 'Unauthorized action.');
        }

        $validated = $request->validated();
        $credentials = $this->credentialsFromValidated($validated, $connection->credentials);

        $this->testConnection($credentials);

        $connection->update([
            'name' => $validated['name'],
            'provider' => CloudProvider::FTP(),
            'provider_id' => $this->providerId($credentials),
            'credentials' => $credentials,
            'status' => ConnectionStatus::CONNECTED(),
            'total_space' => null,
            'used_space' => null,
            'error_message' => null,
            'last_synced_at' => now(),
        ]);

        return redirect()->route('dashboard')->with('success', 'FTP connection updated.');
    }

    /**
     * @param  array<string, mixed>  $validated
     * @param  array<string, mixed>  $existingCredentials
     * @return array<string, mixed>
     */
    private function credentialsFromValidated(array $validated, array $existingCredentials = []): array
    {
        $credentials = [
            'host' => $validated['host'],
            'port' => (int) $validated['port'],
            'username' => $validated['username'],
            'password' => filled($validated['password'] ?? null) ? $validated['password'] : ($existingCredentials['password'] ?? null),
            'root' => $validated['root'] ?? '',
            'ssl' => (bool) ($validated['ssl'] ?? false),
            'passive' => (bool) ($validated['passive'] ?? true),
            'timeout' => isset($validated['timeout']) ? (int) $validated['timeout'] : null,
            'utf8' => (bool) ($validated['utf8'] ?? false),
            'ignore_passive_address' => $validated['ignorePassiveAddress'] ?? null,
            'system_type' => $validated['systemType'] ?? null,
            'recurse_manually' => (bool) ($validated['recurseManually'] ?? true),
            'timestamps_on_unix_listings_enabled' => (bool) ($validated['timestampsOnUnixListingsEnabled'] ?? false),
        ];

        return array_filter($credentials, static fn (mixed $value): bool => $value !== null);
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
                'host' => 'Could not connect to the FTP server. Please check the host, port, credentials, and connection settings.',
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
