<?php

declare(strict_types=1);

namespace App\Support;

use App\Services\Telegram\TelegramAdapter;
use App\Services\Telegram\TelegramHelper;
use Illuminate\Contracts\Filesystem\Filesystem;
use League\Flysystem\UnableToRetrieveMetadata;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Throwable;

final class CloudFileResponseFactory
{
    /**
     * @return array{name: string, mime: string, size: int|null}
     */
    public function resolveMeta(Filesystem $disk, string $path): array
    {
        $adapter = method_exists($disk, 'getAdapter') ? $disk->getAdapter() : null;

        if ($adapter instanceof TelegramAdapter) {
            try {
                // For Telegram Adapter, we can get attributes from file size function which calls metadata
                $attributes = clone $adapter->fileSize($path);

                $extra = $attributes->extraMetadata();
                $name = $extra['file_name'] ?? basename($path);
                $mime = $attributes->mimeType() ?? 'application/octet-stream';
                $size = $attributes->fileSize();

                return ['name' => (string) $name, 'mime' => $mime, 'size' => $size];
            } catch (UnableToRetrieveMetadata $e) {
                throw clone $e;
            } catch (Throwable $e) {
                // Ignore and fall back to the generic logic below
            }
        }

        // For other adapters, we fallback to normal logic
        // Though TelegramHelper::filenameFor is generic, it might hit metadata again for Telegram,
        // but we already caught TelegramAdapter above
        $name = TelegramHelper::filenameFor($disk, $path) ?? basename($path);

        try {
            $mime = $disk->mimeType($path);
        } catch (Throwable) {
            $mime = 'application/octet-stream';
        }

        if ($mime === false || $mime === null) {
            $mime = 'application/octet-stream';
        }

        try {
            $size = $disk->fileSize($path);
        } catch (UnableToRetrieveMetadata $e) {
            if (! $disk->exists($path)) {
                throw $e;
            }
            $size = null;
        } catch (Throwable $e) {
            if (! $disk->exists($path)) {
                throw new UnableToRetrieveMetadata($e->getMessage(), 0, $e);
            }
            $size = null;
        }

        return ['name' => $name, 'mime' => (string) $mime, 'size' => $size];
    }

    public function streamDownload(Filesystem $disk, string $path): StreamedResponse
    {
        try {
            $meta = $this->resolveMeta($disk, $path);
        } catch (UnableToRetrieveMetadata) {
            abort(404, 'File not found on storage.');
        } catch (Throwable) {
            abort(404, 'File not found on storage.');
        }

        $safeName = str_replace(["\r", "\n", '"', '\\'], '', basename($meta['name']));
        $safeName = $safeName === '' ? 'download' : $safeName;

        $response = response()->streamDownload(function () use ($disk, $path) {
            $stream = $disk->readStream($path);
            if (is_resource($stream)) {
                fpassthru($stream);
                fclose($stream);
            }
        }, $safeName, array_filter([
            'Content-Type' => $meta['mime'],
            'Content-Length' => $meta['size'],
            'X-Content-Type-Options' => 'nosniff',
        ]));

        $response->headers->set('Content-Disposition', ContentDisposition::attachment($safeName));

        return $response;
    }

    public function streamInline(Filesystem $disk, string $path): StreamedResponse
    {
        try {
            $meta = $this->resolveMeta($disk, $path);
        } catch (UnableToRetrieveMetadata) {
            abort(404, 'File not found on storage.');
        } catch (Throwable) {
            abort(404, 'File not found on storage.');
        }

        $headers = array_filter([
            'Content-Type' => $meta['mime'],
            'Content-Length' => $meta['size'],
            'Content-Disposition' => ContentDisposition::inline($meta['name']),
            'Cache-Control' => 'private, max-age=3600, must-revalidate',
            'X-Content-Type-Options' => 'nosniff',
        ]);

        if (in_array(strtolower((string) $meta['mime']), ['text/html', 'image/svg+xml', 'application/xml', 'text/xml'], true)) {
            $headers['Content-Security-Policy'] = "default-src 'none'; sandbox";
        }

        return response()->stream(function () use ($disk, $path) {
            $stream = $disk->readStream($path);
            if (is_resource($stream)) {
                fpassthru($stream);
                fclose($stream);
            }
        }, 200, $headers);
    }
}
