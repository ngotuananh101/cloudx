<?php

namespace App\Http\Controllers;

use App\Models\CloudShare;
use App\Services\CloudStorage\CloudFileBrowser;
use App\Services\CloudStorage\CloudFileTypeDetector;
use App\Services\CloudStorage\CloudStorageManager;
use App\Services\CloudStorage\Contracts\ProvidesDirectDownloadLink;
use App\Services\CloudStorage\PathEncoder;
use App\Services\Telegram\TelegramAdapter;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Throwable;

class ShareViewController extends Controller
{
    public function __construct(
        private CloudFileBrowser $fileBrowser,
        private CloudStorageManager $cloudStorage,
    ) {}

    public function index(Request $request, string $uuid): Response
    {
        $share = CloudShare::where('uuid', $uuid)
            ->with(['user', 'cloudConnection'])
            ->first();

        if (! $share) {
            return Inertia::render('share/error', [
                'reason' => 'not_found',
            ]);
        }

        if ($share->expires_at && $share->expires_at->isPast()) {
            return Inertia::render('share/error', [
                'reason' => 'expired',
            ]);
        }

        if ($share->type === 'password' && ! $request->session()->get("share_verified_{$share->id}")) {
            return Inertia::render('share/password', [
                'uuid' => $uuid,
                'share' => [
                    'name' => $share->name,
                ],
            ]);
        }

        $connection = $share->cloudConnection;

        if ($share->is_directory) {
            $encodedPath = $request->query('path', '');
            $decodedPath = $encodedPath ? PathEncoder::decode($encodedPath) : $share->path;

            // Build the full path: share base path + subfolder path
            $browsePath = $encodedPath ? $decodedPath : $share->path;

            try {
                $files = $this->fileBrowser->list($connection, PathEncoder::encode($browsePath));
            } catch (Throwable $exception) {
                Log::error('Could not list shared folder contents.', [
                    'exception' => $exception,
                    'share_uuid' => $uuid,
                    'path' => $browsePath,
                ]);
                $files = [];
            }

            return Inertia::render('share/view', [
                'share' => $this->shareData($share),
                'isDirectory' => true,
                'files' => $files,
                'file' => null,
                'currentPath' => $browsePath,
                'shareBasePath' => $share->path,
                'previewUrl' => null,
                'downloadUrl' => null,
            ]);
        }

        // Single file share
        return Inertia::render('share/view', [
            'share' => $this->shareData($share),
            'isDirectory' => false,
            'files' => [],
            'file' => [
                'name' => $share->name,
                'path' => $share->path,
                'size' => is_array($share->extra_info) ? (int) ($share->extra_info['size'] ?? 0) : 0,
                'type' => CloudFileTypeDetector::detect($share->name, false),
            ],
            'currentPath' => '',
            'shareBasePath' => $share->path,
            'previewUrl' => route('share.preview', ['uuid' => $uuid, 'path' => PathEncoder::encode($share->path)]),
            'downloadUrl' => route('share.download', ['uuid' => $uuid, 'path' => PathEncoder::encode($share->path)]),
        ]);
    }

    public function verify(Request $request, string $uuid): RedirectResponse
    {
        $share = CloudShare::where('uuid', $uuid)->firstOrFail();

        $request->validate([
            'password' => 'required|string',
        ]);

        if (! Hash::check($request->input('password'), $share->password)) {
            return back()->withErrors(['password' => 'Incorrect password.']);
        }

        $request->session()->put("share_verified_{$share->id}", true);

        return redirect()->route('share.view', ['uuid' => $uuid]);
    }

    public function preview(Request $request, string $uuid, ?string $path = null): StreamedResponse
    {
        $share = $this->resolveAndVerify($request, $uuid);
        $decodedPath = $path ? PathEncoder::decode($path) : $share->path;

        try {
            $connector = $this->cloudStorage->connector($share->cloudConnection->provider);
            $disk = $connector->disk($share->cloudConnection);

            abort_unless($disk->exists($decodedPath), 404, 'File not found.');

            $name = TelegramAdapter::filenameFor($disk, $decodedPath) ?? basename($decodedPath);

            try {
                $mimeType = $disk->mimeType($decodedPath);
            } catch (Throwable) {
                $mimeType = 'application/octet-stream';
            }

            try {
                $fileSize = $disk->fileSize($decodedPath);
            } catch (Throwable) {
                $fileSize = null;
            }

            return response()->stream(function () use ($disk, $decodedPath) {
                $stream = $disk->readStream($decodedPath);
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
        } catch (Throwable $exception) {
            Log::error('Could not preview shared file.', [
                'exception' => $exception,
                'share_uuid' => $uuid,
                'path' => $decodedPath,
            ]);

            abort(404, 'File could not be previewed.');
        }
    }

    public function download(Request $request, string $uuid, ?string $path = null): StreamedResponse|RedirectResponse
    {
        $share = $this->resolveAndVerify($request, $uuid);
        $decodedPath = $path ? PathEncoder::decode($path) : $share->path;

        try {
            $connector = $this->cloudStorage->connector($share->cloudConnection->provider);

            if ($connector instanceof ProvidesDirectDownloadLink) {
                $url = $connector->directDownloadLink($share->cloudConnection, $decodedPath);
                if (is_string($url) && $url !== '') {
                    return redirect()->away($url);
                }
            }

            $disk = $connector->disk($share->cloudConnection);
            abort_unless($disk->exists($decodedPath), 404, 'File not found.');

            $name = TelegramAdapter::filenameFor($disk, $decodedPath) ?? basename($decodedPath);

            try {
                $mimeType = $disk->mimeType($decodedPath);
            } catch (Throwable) {
                $mimeType = 'application/octet-stream';
            }

            try {
                $fileSize = $disk->fileSize($decodedPath);
            } catch (Throwable) {
                $fileSize = null;
            }

            return response()->streamDownload(function () use ($disk, $decodedPath) {
                $stream = $disk->readStream($decodedPath);
                if (is_resource($stream)) {
                    fpassthru($stream);
                    fclose($stream);
                }
            }, $name, array_filter([
                'Content-Type' => $mimeType,
                'Content-Length' => $fileSize,
            ]));
        } catch (Throwable $exception) {
            Log::error('Could not download shared file.', [
                'exception' => $exception,
                'share_uuid' => $uuid,
                'path' => $decodedPath,
            ]);

            abort(404, 'File could not be downloaded.');
        }
    }

    private function resolveAndVerify(Request $request, string $uuid): CloudShare
    {
        $share = CloudShare::where('uuid', $uuid)
            ->with('cloudConnection')
            ->firstOrFail();

        abort_if(
            $share->type === 'password' && ! $request->session()->get("share_verified_{$share->id}"),
            403,
            'Password verification required.'
        );

        return $share;
    }

    /**
     * @return array{uuid: string, name: string, type: string, expires_at: string|null, created_at: string, is_directory: bool, user_name: string|null}
     */
    private function shareData(CloudShare $share): array
    {
        return [
            'uuid' => $share->uuid,
            'name' => $share->name,
            'type' => $share->type,
            'expires_at' => $share->expires_at?->toISOString(),
            'created_at' => $share->created_at->toISOString(),
            'is_directory' => $share->is_directory,
            'user_name' => $share->user?->name,
        ];
    }
}
