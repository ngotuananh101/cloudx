<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Enums\CloudProvider;
use App\Enums\ConnectionStatus;
use App\Models\CloudConnection;
use App\Services\CloudStorage\CloudStorageCache;
use App\Services\Telegram\TelegramClient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Session;
use Illuminate\Support\Str;
use RuntimeException;

class TelegramConnectionController extends Controller
{
    public function __construct(private CloudStorageCache $cache) {}

    private function telegramClient(string $sessionId): TelegramClient
    {
        return new TelegramClient(
            url: (string) config('services.telegram-storage.url'),
            token: (string) config('services.telegram-storage.token'),
            sessionId: $sessionId,
        );
    }

    public function requestCode(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'phone' => ['required', 'string', 'max:20'],
        ]);

        $sessionId = Str::random(16);
        $client = $this->telegramClient($sessionId);

        try {
            $phoneCodeHash = $client->sendCodeRequest($validated['phone']);
        } catch (RuntimeException $e) {
            report($e);

            return response()->json([
                'success' => false,
                'message' => 'Could not send code to your Telegram. Please check the phone number.',
            ], 422);
        }

        Session::put('telegram_connect', [
            'session_id' => $sessionId,
            'name' => $validated['name'],
            'phone' => $validated['phone'],
            'phone_code_hash' => $phoneCodeHash,
        ]);

        return response()->json(['success' => true]);
    }

    public function store(Request $request): JsonResponse
    {
        $connect = Session::get('telegram_connect');

        if (! is_array($connect) || ! isset($connect['session_id'])) {
            return response()->json([
                'success' => false,
                'message' => 'Session expired. Please start over.',
            ], 422);
        }

        $validated = $request->validate([
            'code' => ['required', 'string', 'max:10'],
            'password' => ['nullable', 'string', 'max:256'],
        ]);

        $client = $this->telegramClient($connect['session_id']);

        try {
            $result = $client->login(
                phone: $connect['phone'],
                code: $validated['code'],
                phoneCodeHash: $connect['phone_code_hash'] ?? null,
                password: $validated['password'] ?? null,
            );
        } catch (RuntimeException $e) {
            report($e);

            return response()->json([
                'success' => false,
                'message' => 'Could not connect to Telegram service.',
            ], 422);
        }

        if ($result['password_required'] ?? false) {
            return response()->json([
                'password_required' => true,
                'message' => $result['message'] ?? 'Two-factor authentication required.',
            ]);
        }

        if (! ($result['success'] ?? false)) {
            return response()->json([
                'success' => false,
                'message' => $result['message'] ?? 'Login failed. Please try again.',
            ], 422);
        }

        $connection = $request->user()->cloudConnections()->create([
            'name' => $connect['name'],
            'provider' => CloudProvider::TELEGRAM(),
            'provider_id' => $connect['session_id'],
            'credentials' => ['session_id' => $connect['session_id']],
            'status' => ConnectionStatus::CONNECTED(),
            'total_space' => null,
            'used_space' => null,
            'error_message' => null,
            'last_synced_at' => now(),
        ]);

        $synced = $result['synced'] ?? 0;

        Session::forget('telegram_connect');

        return response()->json([
            'success' => true,
            'connection_id' => $connection->id,
            'synced' => $synced,
        ]);
    }

    public function sync(Request $request, CloudConnection $connection): RedirectResponse
    {
        if ($connection->user_id !== $request->user()->id) {
            abort(403);
        }

        if ($connection->provider?->value !== CloudProvider::TELEGRAM) {
            abort(400, 'Not a Telegram connection');
        }

        $sessionId = $connection->credentials['session_id'] ?? null;
        if (! $sessionId) {
            abort(400, 'Invalid Telegram session');
        }

        $client = $this->telegramClient($sessionId);

        try {
            $syncedCount = $client->sync();
        } catch (RuntimeException $e) {
            report($e);

            return redirect()->back()->withErrors([
                'telegram' => 'Could not sync with Telegram service.',
            ]);
        }

        $this->cache->flushConnection($connection);
        $connection->update(['last_synced_at' => now()]);

        return redirect()->back()->with(
            'success',
            "Synced {$syncedCount} item(s) from Telegram.",
        );
    }
}
