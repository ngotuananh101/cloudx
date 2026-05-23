<?php

namespace App\Http\Controllers;

use App\Models\CloudConnection;
use App\Services\CloudStorage\CloudFileBrowser;
use App\Services\CloudStorage\CloudStorageManager;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;
use Inertia\Response;
use Throwable;

class StorageBrowserController extends Controller
{
    public function __construct(
        private CloudFileBrowser $fileBrowser,
        private CloudStorageManager $cloudStorage,
    ) {}

    public function index(CloudConnection $connection, string $path = ''): Response
    {
        abort_if($connection->user_id !== auth()->id(), 403, 'Unauthorized access to this connection.');

        $decodedPath = $this->fileBrowser->decodedPath($path);

        try {
            $files = $this->fileBrowser->list($connection, $path);
        } catch (Throwable $exception) {
            Log::error('Could not retrieve cloud storage files.', [
                'exception' => $exception,
                'connection_id' => $connection->id,
                'provider' => $connection->provider->value,
                'path' => $path,
            ]);
            $files = [];
            session()->flash('error', 'Could not retrieve files from this storage.');
        }

        $connector = $this->cloudStorage->connector($connection->provider);

        return Inertia::render('files/index', [
            'connection' => [
                'id' => $connection->id,
                'name' => $connection->name,
                'provider' => $connection->provider->value,
                'capabilities' => $connector->capabilities()->toArray(),
            ],
            'currentPath' => $path,
            'decodedPath' => $decodedPath,
            'files' => $files,
        ]);
    }
}
