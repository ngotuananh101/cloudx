<?php

namespace App\Http\Controllers;

use App\Models\CloudShare;
use App\Services\CloudStorage\CloudFileBrowser;
use App\Services\CloudStorage\CloudFileTypeDetector;
use App\Services\CloudStorage\CloudStorageManager;
use App\Services\CloudStorage\Contracts\ProvidesDirectDownloadLink;
use App\Services\CloudStorage\PathEncoder;
use App\Services\Telegram\TelegramHelper;
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
    private const FILE_NOT_FOUND = 'File not found.';

    public function __construct(
        private CloudFileBrowser $fileBrowser,
        private CloudStorageManager $cloudStorage,
    ) {}

    public function index(Request $request, string $uuid): Response
    {
        $share = CloudShare::where('uuid', $uuid)
            ->with(['user', 'cloudConnection'])
            ->first();

        $gate = $this->shareAccessResponse($request, $share, $uuid);

        if ($gate !== null) {
            return $gate;
        }

        return $this->renderShareView($request, $share, $uuid);
    }

    private function shareAccessResponse(Request $request, ?CloudShare $share, string $uuid): ?Response
    {
        if (! $share) {
            return $this->renderShareError('not_found');
        }

        if ($this->isExpired($share)) {
            return $this->renderShareError('expired');
        }

        return ($share->type === 'password' && ! $request->session()->get("share_verified_{$share->id}"))
            ? $this->renderPasswordPrompt($share, $uuid)
            : null;
    }

    private function renderShareError(string $reason): Response
    {
        return Inertia::render('share/error', [
            'reason' => $reason,
        ]);
    }

    private function renderPasswordPrompt(CloudShare $share, string $uuid): Response
    {
        return Inertia::render('share/password', [
            'uuid' => $uuid,
            'share' => [
                'name' => $share->name,
            ],
        ]);
    }

    private function renderShareView(Request $request, CloudShare $share, string $uuid): Response
    {
        $connection = $share->cloudConnection;

        if ($share->is_directory) {
            $encodedPath = $request->query('path', '');
            $browsePath = $encodedPath !== '' && $encodedPath !== null
                ? $this->assertPathWithinShare($share, PathEncoder::decode((string) $encodedPath))
                : $this->normalizePath($share->path);

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
                'shareBasePath' => $this->normalizePath($share->path),
                'previewUrl' => null,
                'downloadUrl' => null,
            ]);
        }

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
            'shareBasePath' => $this->normalizePath($share->path),
            'previewUrl' => route('share.preview', ['uuid' => $uuid, 'path' => PathEncoder::encode($share->path)]),
            'downloadUrl' => route('share.download', ['uuid' => $uuid, 'path' => PathEncoder::encode($share->path)]),
        ]);
    }

    public function verify(Request $request, string $uuid): RedirectResponse
    {
        $share = CloudShare::where('uuid', $uuid)->firstOrFail();

        abort_if($this->isExpired($share), 404, 'This share link has expired.');

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
        $decodedPath = $this->resolvedSharePath($share, $path);

        try {
            $connector = $this->cloudStorage->connector($share->cloudConnection->provider);
            $disk = $connector->disk($share->cloudConnection);

            abort_unless($disk->exists($decodedPath), 404, self::FILE_NOT_FOUND);

            $name = TelegramHelper::filenameFor($disk, $decodedPath) ?? basename($decodedPath);

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
        $decodedPath = $this->resolvedSharePath($share, $path);

        try {
            $connector = $this->cloudStorage->connector($share->cloudConnection->provider);

            if ($connector instanceof ProvidesDirectDownloadLink) {
                $url = $connector->directDownloadLink($share->cloudConnection, $decodedPath);
                if (is_string($url) && $url !== '') {
                    return redirect()->away($url);
                }
            }

            $disk = $connector->disk($share->cloudConnection);
            abort_unless($disk->exists($decodedPath), 404, self::FILE_NOT_FOUND);

            $name = TelegramHelper::filenameFor($disk, $decodedPath) ?? basename($decodedPath);

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

        abort_if($this->isExpired($share), 404, 'This share link has expired.');

        abort_if(
            $share->type === 'password' && ! $request->session()->get("share_verified_{$share->id}"),
            403,
            'Password verification required.'
        );

        return $share;
    }

    private function resolvedSharePath(CloudShare $share, ?string $encodedPath): string
    {
        if ($encodedPath === null || $encodedPath === '') {
            return $this->assertPathWithinShare($share, $share->path);
        }

        return $this->assertPathWithinShare($share, PathEncoder::decode($encodedPath));
    }

    private function assertPathWithinShare(CloudShare $share, string $path): string
    {
        $normalizedPath = $this->normalizePath($path);
        $shareBasePath = $this->normalizePath($share->path);

        if (! $share->is_directory) {
            abort_unless($normalizedPath === $shareBasePath, 404, self::FILE_NOT_FOUND);

            return $normalizedPath;
        }

        if ($shareBasePath === '') {
            return $normalizedPath;
        }

        abort_unless(
            $normalizedPath === $shareBasePath || str_starts_with($normalizedPath.'/', $shareBasePath.'/'),
            404,
            self::FILE_NOT_FOUND
        );

        return $normalizedPath;
    }

    private function normalizePath(string $path): string
    {
        $segments = [];

        foreach (explode('/', str_replace('\\', '/', $path)) as $segment) {
            if ($segment === '' || $segment === '.') {
                continue;
            }

            if ($segment === '..') {
                array_pop($segments);

                continue;
            }

            $segments[] = $segment;
        }

        return implode('/', $segments);
    }

    private function isExpired(CloudShare $share): bool
    {
        return $share->expires_at !== null && $share->expires_at->isPast();
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
