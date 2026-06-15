<?php

namespace App\Http\Controllers;

use App\Models\CloudConnection;
use App\Services\CloudStorage\CloudStorageManager;
use App\Services\CloudStorage\PathEncoder;
use App\Services\Telegram\TelegramAdapter;
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
        abort_unless($disk->exists($path), 404, 'File not found on storage.');

        $name = TelegramAdapter::filenameFor($disk, $path) ?? basename($path);

        try {
            $mimeType = $disk->mimeType($path);
        } catch (Throwable $e) {
            $mimeType = 'application/octet-stream';
        }

        try {
            $fileSize = $disk->fileSize($path);
        } catch (Throwable $e) {
            $fileSize = null;
        }

        return response()->stream(function () use ($disk, $path) {
            $stream = $disk->readStream($path);
            if (is_resource($stream)) {
                fpassthru($stream);
                fclose($stream);
            }
        }, 200, array_filter([
            'Content-Type' => $mimeType,
            'Content-Length' => $fileSize,
            'Content-Disposition' => 'inline; filename="'.addslashes($name).'"',
            'Cache-Control' => 'public, max-age=31536000, immutable',
        ]));
    }
}
