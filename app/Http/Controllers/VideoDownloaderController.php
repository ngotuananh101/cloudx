<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Exceptions\PythonServiceException;
use App\Services\Python\YtDlpClient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class VideoDownloaderController extends Controller
{
    public function __construct(private YtDlpClient $client) {}

    public function index(): Response
    {
        return Inertia::render('video-downloader/index');
    }

    public function metadata(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'url' => ['required', 'string', 'url', 'max:2048'],
            'cookies' => ['nullable', 'string', 'max:65535'],
        ]);

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

    public function download(Request $request): StreamedResponse
    {
        $validated = $request->validate([
            'url' => ['required', 'string', 'url', 'max:2048'],
            'format_id' => ['required', 'string', 'max:64'],
            'audio_only' => ['nullable', 'boolean'],
            'cookies' => ['nullable', 'string', 'max:65535'],
        ]);

        try {
            $result = $this->client->downloadStream(
                $validated['url'],
                $validated['format_id'],
                (bool) ($validated['audio_only'] ?? false),
                $validated['cookies'] ?? null,
            );
        } catch (PythonServiceException $exception) {
            Log::warning('yt-dlp download request failed.', [
                'exception' => $exception,
                'url' => $validated['url'],
                'format_id' => $validated['format_id'],
            ]);

            abort(502, 'Could not download the video.');
        }

        $headers = array_filter([
            'Content-Type' => $result['content_type'],
            'Content-Length' => $result['content_length'],
            'Content-Disposition' => 'attachment; filename="'.$result['filename'].'"',
        ], fn ($v) => $v !== null);

        return response()->stream(function () use ($result) {
            set_time_limit(0);
            ignore_user_abort(true);
            $stream = $result['stream'];
            fpassthru($stream);
            fclose($stream);
        }, 200, $headers);
    }
}
