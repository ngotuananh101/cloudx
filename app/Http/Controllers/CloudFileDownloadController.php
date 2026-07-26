<?php

namespace App\Http\Controllers;

use App\Models\CloudConnection;
use App\Services\CloudStorage\CloudStorageManager;
use App\Services\CloudStorage\Contracts\ProvidesDirectDownloadLink;
use App\Services\CloudStorage\PathEncoder;
use App\Support\CloudFileResponseFactory;
use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Throwable;

class CloudFileDownloadController extends Controller
{
    public function __construct(
        private CloudStorageManager $cloudStorage,
    ) {}

    public function download(CloudConnection $connection, ?string $path = null): StreamedResponse|RedirectResponse
    {
        abort_if($connection->user_id !== auth()->id(), 403, 'Unauthorized access to this connection.');

        $decodedPath = PathEncoder::decode($path);

        try {
            $connector = $this->cloudStorage->connector($connection->provider);

            if ($connector instanceof ProvidesDirectDownloadLink) {
                $url = $connector->directDownloadLink($connection, $decodedPath);

                if (is_string($url) && $url !== '') {
                    return redirect()->away($url);
                }
            }

            $disk = $connector->disk($connection);

            return $this->streamFromDisk($disk, $decodedPath);
        } catch (Throwable $exception) {
            Log::error('Could not download cloud storage file.', [
                'exception' => $exception,
                'connection_id' => $connection->id,
                'provider' => $connection->provider->value,
                'path' => $decodedPath,
            ]);

            abort(404, 'File could not be downloaded.');
        }
    }

    private function streamFromDisk(Filesystem $disk, string $path): StreamedResponse
    {
        /** @var CloudFileResponseFactory $factory */
        $factory = app(CloudFileResponseFactory::class);

        return $factory->streamDownload($disk, $path);
    }
}
