<?php

namespace App\Http\Controllers;

use App\Models\CloudConnection;
use App\Services\CloudStorage\CloudStorageManager;
use App\Services\CloudStorage\PathEncoder;
use App\Support\CloudFileResponseFactory;
use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Throwable;

class CloudFilePreviewController extends Controller
{
    public function __construct(
        private CloudStorageManager $cloudStorage,
    ) {}

    public function preview(CloudConnection $connection, ?string $path = null): StreamedResponse
    {
        abort_if($connection->user_id !== auth()->id(), 403, 'Unauthorized access to this connection.');

        $decodedPath = PathEncoder::decode($path);

        try {
            $connector = $this->cloudStorage->connector($connection->provider);
            $disk = $connector->disk($connection);

            return $this->streamFromDisk($disk, $decodedPath);
        } catch (Throwable $exception) {
            Log::error('Could not preview cloud storage file.', [
                'exception' => $exception,
                'connection_id' => $connection->id,
                'provider' => $connection->provider->value,
                'path' => $decodedPath,
            ]);

            abort(404, 'File could not be previewed.');
        }
    }

    private function streamFromDisk(Filesystem $disk, string $path): StreamedResponse
    {
        /** @var CloudFileResponseFactory $factory */
        $factory = app(CloudFileResponseFactory::class);

        return $factory->streamInline($disk, $path);
    }
}
