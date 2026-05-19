<?php

namespace App\Http\Controllers;

use App\Enums\CloudProvider;
use App\Enums\ConnectionStatus;
use App\Models\CloudConnection;
use Google\Client;
use Google\Service\Drive;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class CloudConnectionController extends Controller
{
    /**
     * Redirect the user to the Google OAuth page.
     */
    public function redirectToGoogle(): RedirectResponse
    {
        $client = app(Client::class);
        $client->setClientId(config('services.google.client_id'));
        $client->setClientSecret(config('services.google.client_secret'));
        $client->setRedirectUri(config('services.google.redirect_uri'));

        // Scope to access Google Drive files
        $client->addScope(Drive::DRIVE);

        // Request offline access to get a refresh_token
        $client->setAccessType('offline');

        // Force consent to always get a new refresh_token
        $client->setPrompt('consent');

        $authUrl = $client->createAuthUrl();

        return redirect()->away($authUrl);
    }

    /**
     * Handle the callback from Google.
     */
    public function handleGoogleCallback(Request $request): RedirectResponse
    {
        $code = $request->query('code');

        if (! $code) {
            return redirect()->route('dashboard')->with('error', 'Google authentication failed or was cancelled.');
        }

        $client = app(Client::class);
        $client->setClientId(config('services.google.client_id'));
        $client->setClientSecret(config('services.google.client_secret'));
        $client->setRedirectUri(config('services.google.redirect_uri'));

        try {
            $token = $client->fetchAccessTokenWithAuthCode($code);

            if (isset($token['error'])) {
                return redirect()->route('dashboard')->with('error', 'Failed to retrieve access token: '.($token['error_description'] ?? $token['error']));
            }

            $client->setAccessToken($token);

            // Fetch user info and quota details from Google Drive Service
            $driveService = app(Drive::class);
            $about = $driveService->about->get(['fields' => 'user,storageQuota']);

            $googleUser = $about->getUser();
            $emailAddress = $googleUser->getEmailAddress() ?? 'Google Drive';

            $quota = $about->getStorageQuota();
            $totalSpace = $quota->getLimit();
            $usedSpace = $quota->getUsage();

            // Create or update the connection for the authenticated user uniquely by provider_id
            $connection = $request->user()->cloudConnections()->firstOrNew([
                'provider' => CloudProvider::GOOGLE_DRIVE(),
                'provider_id' => $emailAddress,
            ]);

            if (! $connection->exists) {
                $connection->name = 'Google Drive ('.$emailAddress.')';
            }

            $connection->fill([
                'credentials' => $token,
                'status' => ConnectionStatus::CONNECTED(),
                'total_space' => $totalSpace,
                'used_space' => $usedSpace,
                'error_message' => null,
                'last_synced_at' => now(),
            ])->save();

            return redirect()->route('dashboard')->with('success', 'Successfully connected to Google Drive!');
        } catch (\Exception $e) {
            return redirect()->route('dashboard')->with('error', 'An error occurred: '.$e->getMessage());
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
