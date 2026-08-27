<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Enums\ActivityAction;
use App\Exceptions\DownloadFileNotReadyException;
use App\Exceptions\DownloadJobNotFoundException;
use App\Exceptions\PythonServiceException;
use App\Models\SavedCookie;
use App\Services\ActivityLogger;
use App\Services\CloudStorage\RemoteUploadUrlGuard;
use App\Services\Python\YtDlpClient;
use App\Support\ContentDisposition;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class VideoDownloaderController extends Controller
{
    public function __construct(
        private YtDlpClient $client,
        private ActivityLogger $activityLogger,
        private RemoteUploadUrlGuard $urlGuard,
    ) {}

    public function index(Request $request): Response
    {
        $savedCookies = SavedCookie::query()
            ->where('user_id', $request->user()->id)
            ->orderByDesc('created_at')
            ->get(['id', 'label', 'created_at']);

        return Inertia::render('video-downloader/index', [
            'savedCookies' => $savedCookies,
        ]);
    }

    public function metadata(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'url' => ['required', 'string', 'url', 'max:2048'],
            'cookies' => ['nullable', 'string', 'max:65535'],
        ]);

        $this->urlGuard->validate($validated['url']);

        $request->session()->put('video_downloader.cookies', $validated['cookies'] ?? null);

        try {
            $data = $this->client->fetchMetadata(
                $validated['url'],
                $validated['cookies'] ?? null,
            );
        } catch (PythonServiceException $exception) {
            Log::warning('yt-dlp metadata request failed.', [
                'exception' => $exception,
                'url' => $validated['url'],
            ]);

            return response()->json([
                'message' => 'Could not fetch video metadata.',
            ], 502);
        }

        return response()->json($data);
    }

    public function startJob(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'url' => ['required', 'string', 'url', 'max:2048'],
            'format_id' => ['required', 'string', 'max:64'],
            'audio_only' => ['nullable', 'boolean'],
        ]);

        $this->urlGuard->validate($validated['url']);

        $cookies = $request->session()->get('video_downloader.cookies');
        $cookies = is_string($cookies) ? $cookies : null;

        $request->session()->put('video_downloader.url', $validated['url']);

        try {
            $job = $this->client->startDownloadJob(
                $validated['url'],
                $validated['format_id'],
                (bool) ($validated['audio_only'] ?? false),
                $cookies,
            );
        } catch (PythonServiceException $exception) {
            Log::warning('yt-dlp job start failed.', [
                'exception' => $exception,
                'url' => $validated['url'],
            ]);

            return response()->json([
                'message' => 'Could not start the video download.',
            ], 502);
        }

        return response()->json($job);
    }

    public function jobStatus(Request $request, string $jobId): JsonResponse
    {
        try {
            $status = $this->client->getDownloadJobStatus($jobId);
        } catch (DownloadJobNotFoundException) {
            return response()->json([
                'message' => 'Download job not found or expired.',
            ], 404);
        } catch (PythonServiceException $exception) {
            Log::warning('yt-dlp job status failed.', [
                'exception' => $exception,
                'job_id' => $jobId,
            ]);

            return response()->json([
                'message' => 'Could not check download status.',
            ], 502);
        }

        return response()->json($status);
    }

    public function jobDownload(Request $request, string $jobId): StreamedResponse
    {
        try {
            $result = $this->client->getDownloadJobFileStream($jobId);
        } catch (DownloadJobNotFoundException) {
            abort(404, 'Download job not found or expired.');
        } catch (DownloadFileNotReadyException) {
            abort(409, 'Download is not ready yet.');
        } catch (PythonServiceException $exception) {
            Log::warning('yt-dlp job file failed.', [
                'exception' => $exception,
                'job_id' => $jobId,
            ]);

            abort(502, 'Could not stream the downloaded file.');
        }

        $headers = array_filter([
            'Content-Type' => $result['content_type'],
            'Content-Length' => $result['content_length'],
            'Content-Disposition' => ContentDisposition::attachment((string) $result['filename']),
            'X-Content-Type-Options' => 'nosniff',
        ], fn ($v) => $v !== null);

        $url = $request->session()->get('video_downloader.url');

        $this->activityLogger->log(
            user: $request->user(),
            action: ActivityAction::VideoDownloaded,
            subjectName: $result['filename'],
            targetName: is_string($url) ? $url : $jobId,
        );

        return response()->stream(function () use ($result) {
            set_time_limit(0);
            ignore_user_abort(true);
            $stream = $result['stream'];
            fpassthru($stream);
            fclose($stream);
        }, 200, $headers);
    }
}
