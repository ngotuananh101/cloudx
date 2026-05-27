<?php

namespace App\Http\Controllers;

use App\Enums\CloudProvider;
use App\Enums\ConnectionStatus;
use App\Models\CloudConnection;
use App\Services\CloudStorage\CloudStorageCache;
use App\Services\CloudStorage\CloudStorageManager;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Throwable;

class CloudConnectionController extends Controller
{
    public function __construct(
        private CloudStorageManager $cloudStorage,
        private CloudStorageCache $cache,
    ) {}

    public function redirect(string $provider): RedirectResponse
    {
        $cloudProvider = CloudProvider::fromSlug($provider);

        if ($cloudProvider === null) {
            abort(404);
        }

        return redirect()->away($this->cloudStorage->connector($cloudProvider)->redirectUrl());
    }

    public function reconnect(Request $request, CloudConnection $connection): RedirectResponse
    {
        if ($connection->user_id !== $request->user()->id) {
            abort(403, 'Unauthorized action.');
        }

        if (! $connection->canReconnect()) {
            abort(403, 'This connection cannot be reconnected.');
        }

        $request->session()->put('cloud_connection_reconnect', [
            'connection_id' => $connection->id,
            'provider' => $connection->provider->value,
            'provider_id' => $connection->provider_id,
        ]);

        return redirect()->away($this->cloudStorage->connector($connection->provider)->redirectUrl());
    }

    public function callback(Request $request, string $provider): RedirectResponse
    {
        $cloudProvider = CloudProvider::fromSlug($provider);

        if ($cloudProvider === null) {
            abort(404);
        }

        try {
            $account = $this->cloudStorage->connector($cloudProvider)->handleCallback($request);
            $pendingReconnect = $request->session()->get('cloud_connection_reconnect');

            if ($pendingReconnect !== null) {
                $request->session()->forget('cloud_connection_reconnect');

                $connection = CloudConnection::whereKey($pendingReconnect['connection_id'])
                    ->where('user_id', $request->user()->id)
                    ->firstOrFail();

                if ((int) $pendingReconnect['provider'] !== $cloudProvider->value || $pendingReconnect['provider_id'] !== $account->providerId) {
                    return redirect()->route('dashboard')->with('error', "Reconnect failed because the selected account does not match {$connection->name}.");
                }

                $connection->fill([
                    'credentials' => $account->credentials,
                    'status' => ConnectionStatus::CONNECTED(),
                    'total_space' => $account->totalSpace,
                    'used_space' => $account->usedSpace,
                    'error_message' => null,
                    'last_synced_at' => now(),
                ])->save();

                return redirect()->route('dashboard')->with('success', "Successfully reconnected {$connection->name}.");
            }

            $connection = $request->user()->cloudConnections()->firstOrNew([
                'provider' => $cloudProvider,
                'provider_id' => $account->providerId,
            ]);

            $connection->fill([
                'name' => $account->name,
                'credentials' => $account->credentials,
                'status' => ConnectionStatus::CONNECTED(),
                'total_space' => $account->totalSpace,
                'used_space' => $account->usedSpace,
                'error_message' => null,
                'last_synced_at' => now(),
            ])->save();

            return redirect()->route('dashboard')->with('success', "Successfully connected to {$cloudProvider->description}!");
        } catch (Throwable $exception) {
            $request->session()->forget('cloud_connection_reconnect');
            report($exception);

            return redirect()->route('dashboard')->with('error', "Could not connect to {$cloudProvider->description}.");
        }
    }

    public function updateName(Request $request, CloudConnection $connection): RedirectResponse
    {
        if ($connection->user_id !== $request->user()->id) {
            abort(403, 'Unauthorized action.');
        }

        if (! $connection->canEditName()) {
            abort(403, 'This connection name cannot be edited.');
        }

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
        ]);

        $connection->update([
            'name' => $validated['name'],
        ]);

        return back()->with('success', 'Connection name updated.');
    }

    /**
     * Disconnect/Remove a cloud connection.
     */
    public function disconnect(Request $request, CloudConnection $connection): RedirectResponse
    {
        // Ensure the connection belongs to the logged-in user
        if ($connection->user_id !== $request->user()->id) {
            abort(403, 'Unauthorized action.');
        }

        if (! $connection->canDelete()) {
            abort(403, 'This connection cannot be deleted.');
        }

        $this->cache->flushConnection($connection);
        $connection->delete();

        return redirect()->route('dashboard')->with('success', 'Successfully disconnected '.$connection->name);
    }
}
