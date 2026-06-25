<?php

use App\Exceptions\PythonServiceException;
use App\Services\Python\YtDlpClient;
use Illuminate\Support\Facades\Http;

const YTDLP_BASE_URL = 'http://localhost:8000';
const YTDLP_TEST_URL = 'https://example.com/watch?v=1';
const SIMPLE_URL = 'https://example.com';
const MIME_MP4 = 'video/mp4';
const YTDLP_TEST_TOKEN = 'test-token';

beforeEach(function () {
    config(['services.python-service.url' => YTDLP_BASE_URL]);
    config(['services.python-service.token' => YTDLP_TEST_TOKEN]);
});

it('fetches metadata and unwraps the success/data envelope', function () {
    Http::fake([
        'http://localhost:8000/yt-dlp/metadata' => Http::response([
            'success' => true,
            'data' => [
                'title' => 'Sample',
                'duration' => 60,
                'thumbnail' => 'https://example.com/t.jpg',
                'uploader' => 'Uploader',
                'view_count' => 100,
                'description' => 'desc',
                'webpage_url' => YTDLP_TEST_URL,
                'formats' => [
                    ['format_id' => '18', 'ext' => 'mp4', 'resolution' => '640x360', 'filesize' => 1000, 'vcodec' => 'avc1', 'acodec' => 'mp4a', 'tbr' => 200.0, 'format_note' => '360p'],
                ],
            ],
        ]),
    ]);

    $client = new YtDlpClient(YTDLP_BASE_URL, YTDLP_TEST_TOKEN);

    $data = $client->fetchMetadata(YTDLP_TEST_URL);

    expect($data['title'])->toBe('Sample')
        ->and($data['duration'])->toBe(60)
        ->and($data['formats'][0])->toMatchArray([
            'format_id' => '18',
            'ext' => 'mp4',
            'resolution' => '640x360',
        ]);

    Http::assertSent(function ($request) {
        return $request->url() === 'http://localhost:8000/yt-dlp/metadata'
            && $request['url'] === YTDLP_TEST_URL
            && $request->hasHeader('X-Token', YTDLP_TEST_TOKEN);
    });
});

it('throws when metadata response has success: false', function () {
    Http::fake([
        'http://localhost:8000/yt-dlp/metadata' => Http::response([
            'success' => false,
            'message' => 'Video unavailable.',
        ]),
    ]);

    $client = new YtDlpClient(YTDLP_BASE_URL, YTDLP_TEST_TOKEN);

    expect(fn () => $client->fetchMetadata(YTDLP_TEST_URL))
        ->toThrow(PythonServiceException::class, 'Video unavailable.');
});

it('throws when metadata response is missing the data wrapper', function () {
    Http::fake([
        'http://localhost:8000/yt-dlp/metadata' => Http::response(['success' => true]),
    ]);

    $client = new YtDlpClient(YTDLP_BASE_URL, YTDLP_TEST_TOKEN);

    expect(fn () => $client->fetchMetadata(YTDLP_TEST_URL))
        ->toThrow(PythonServiceException::class);
});

it('sends cookies when provided to fetchMetadata', function () {
    Http::fake([
        'http://localhost:8000/yt-dlp/metadata' => Http::response([
            'success' => true,
            'data' => ['title' => 't', 'duration' => 0, 'thumbnail' => '', 'uploader' => 'u', 'view_count' => 0, 'description' => '', 'webpage_url' => SIMPLE_URL, 'formats' => []],
        ]),
    ]);

    $client = new YtDlpClient(YTDLP_BASE_URL, YTDLP_TEST_TOKEN);
    $client->fetchMetadata(SIMPLE_URL, 'cookie=value');

    Http::assertSent(fn ($request) => $request['cookies'] === 'cookie=value');
});

it('downloadStream returns the stream resource, content type, filename, and content length', function () {
    Http::fake([
        'http://localhost:8000/yt-dlp/download' => Http::response('binary-body', 200, [
            'Content-Type' => MIME_MP4,
            'Content-Disposition' => 'attachment; filename="ytdlp_dl_abc123.mp4"',
            'Content-Length' => '11',
        ]),
    ]);

    $client = new YtDlpClient(YTDLP_BASE_URL, YTDLP_TEST_TOKEN);

    $result = $client->downloadStream(YTDLP_TEST_URL, '18', false);

    expect($result['content_type'])->toBe(MIME_MP4)
        ->and($result['filename'])->toBe('ytdlp_dl_abc123.mp4')
        ->and($result['content_length'])->toBe(11)
        ->and(is_resource($result['stream']))->toBeTrue();

    rewind($result['stream']);
    expect(stream_get_contents($result['stream']))->toBe('binary-body');

    Http::assertSent(function ($request) {
        return $request->url() === 'http://localhost:8000/yt-dlp/download'
            && $request['url'] === YTDLP_TEST_URL
            && $request['format_id'] === '18'
            && $request['audio_only'] === false;
    });
});

it('downloadStream falls back to a default filename when the header is missing', function () {
    Http::fake([
        'http://localhost:8000/yt-dlp/download' => Http::response('binary-body', 200, [
            'Content-Type' => MIME_MP4,
        ]),
    ]);

    $client = new YtDlpClient(YTDLP_BASE_URL, YTDLP_TEST_TOKEN);
    $result = $client->downloadStream(SIMPLE_URL, '18', false);

    expect($result['filename'])->toBe('ytdlp_dl.mp4');
});

it('downloadStream marks audio_only true in the request body', function () {
    Http::fake([
        'http://localhost:8000/yt-dlp/download' => Http::response('x', 200, [
            'Content-Type' => 'audio/mp4',
            'Content-Disposition' => 'attachment; filename="ytdlp_dl_abc.m4a"',
        ]),
    ]);

    $client = new YtDlpClient(YTDLP_BASE_URL, YTDLP_TEST_TOKEN);
    $client->downloadStream(SIMPLE_URL, '140', true);

    Http::assertSent(fn ($request) => $request['audio_only'] === true);
});
