<?php

namespace App\Http\Controllers;

use App\Enums\CloudProvider;
use App\Models\CloudConnection;
use App\Services\CloudStorage\CloudFileBrowser;
use App\Services\CloudStorage\CloudStorageManager;
use App\Services\CloudStorage\CloudStorageQuota;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;
use Inertia\Response;
use Throwable;

class StorageBrowserController extends Controller
{
    public function __construct(
        private CloudFileBrowser $fileBrowser,
        private CloudStorageManager $cloudStorage,
        private CloudStorageQuota $storageQuota,
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
        $this->storageQuota->refreshInBackground($connection);

        return Inertia::render('files/index', [
            'connection' => [
                'id' => $connection->id,
                'name' => $connection->name,
                'provider' => $connection->provider->value,
                'provider_label' => $connection->provider->getDescription(),
                'provider_icon' => CloudProvider::getIcon($connection->provider->value),
                'capabilities' => $connector->capabilities()->toArray(),
                'storageQuota' => $this->storageQuota->get($connection),
            ],
            'currentPath' => $path,
            'decodedPath' => $decodedPath,
            'files' => $files,
        ]);
    }
}
