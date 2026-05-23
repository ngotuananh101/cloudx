<?php

namespace App\Http\Controllers;

use App\Enums\CloudProvider;
use App\Enums\ConnectionStatus;
use App\Models\CloudConnection;
use App\Services\CloudStorage\CloudStorageManager;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Throwable;

class CloudConnectionController extends Controller
{
    public function __construct(private CloudStorageManager $cloudStorage) {}

    public function redirect(string $provider): RedirectResponse
    {
        $cloudProvider = CloudProvider::fromSlug($provider);

        if ($cloudProvider === null) {
            abort(404);
        }

        return redirect()->away($this->cloudStorage->connector($cloudProvider)->redirectUrl());
    }

    public function callback(Request $request, string $provider): RedirectResponse
    {
        $cloudProvider = CloudProvider::fromSlug($provider);

        if ($cloudProvider === null) {
            abort(404);
        }

        try {
            $account = $this->cloudStorage->connector($cloudProvider)->handleCallback($request);

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
            report($exception);

            return redirect()->route('dashboard')->with('error', "Could not connect to {$cloudProvider->description}.");
        }
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

        $connection->delete();

        return redirect()->route('dashboard')->with('success', 'Successfully disconnected '.$connection->name);
    }
}
