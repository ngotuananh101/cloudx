<?php

use App\Services\Python\YtDlpClient;
use Illuminate\Support\Facades\Http;
use RuntimeException;

beforeEach(function () {
    config(['services.python-service.url' => 'http://localhost:8000']);
    config(['services.python-service.token' => 'test-token']);
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
                'webpage_url' => 'https://example.com/watch?v=1',
                'formats' => [
                    ['format_id' => '18', 'ext' => 'mp4', 'resolution' => '640x360', 'filesize' => 1000, 'vcodec' => 'avc1', 'acodec' => 'mp4a', 'tbr' => 200.0, 'format_note' => '360p'],
                ],
            ],
        ]),
    ]);

    $client = new YtDlpClient('http://localhost:8000', 'test-token');

    $data = $client->fetchMetadata('https://example.com/watch?v=1');

    expect($data['title'])->toBe('Sample')
        ->and($data['duration'])->toBe(60)
        ->and($data['formats'][0])->toMatchArray([
            'format_id' => '18',
            'ext' => 'mp4',
            'resolution' => '640x360',
        ]);

    Http::assertSent(function ($request) {
        return $request->url() === 'http://localhost:8000/yt-dlp/metadata'
            && $request['url'] === 'https://example.com/watch?v=1'
            && $request->hasHeader('X-Token', 'test-token');
    });
});

it('throws when metadata response has success: false', function () {
    Http::fake([
        'http://localhost:8000/yt-dlp/metadata' => Http::response([
            'success' => false,
            'message' => 'Video unavailable.',
        ]),
    ]);

    $client = new YtDlpClient('http://localhost:8000', 'test-token');

    expect(fn () => $client->fetchMetadata('https://example.com/watch?v=1'))
        ->toThrow(RuntimeException::class, 'Video unavailable.');
});

it('throws when metadata response is missing the data wrapper', function () {
    Http::fake([
        'http://localhost:8000/yt-dlp/metadata' => Http::response(['success' => true]),
    ]);

    $client = new YtDlpClient('http://localhost:8000', 'test-token');

    expect(fn () => $client->fetchMetadata('https://example.com/watch?v=1'))
        ->toThrow(RuntimeException::class);
});

it('sends cookies when provided to fetchMetadata', function () {
    Http::fake([
        'http://localhost:8000/yt-dlp/metadata' => Http::response([
            'success' => true,
            'data' => ['title' => 't', 'duration' => 0, 'thumbnail' => '', 'uploader' => 'u', 'view_count' => 0, 'description' => '', 'webpage_url' => 'https://example.com', 'formats' => []],
        ]),
    ]);

    $client = new YtDlpClient('http://localhost:8000', 'test-token');
    $client->fetchMetadata('https://example.com', 'cookie=value');

    Http::assertSent(fn ($request) => $request['cookies'] === 'cookie=value');
});

it('downloadStream returns the stream resource, content type, filename, and content length', function () {
    Http::fake([
        'http://localhost:8000/yt-dlp/download' => Http::response('binary-body', 200, [
            'Content-Type' => 'video/mp4',
            'Content-Disposition' => 'attachment; filename="ytdlp_dl_abc123.mp4"',
            'Content-Length' => '11',
        ]),
    ]);

    $client = new YtDlpClient('http://localhost:8000', 'test-token');

    $result = $client->downloadStream('https://example.com/watch?v=1', '18', false);

    expect($result['content_type'])->toBe('video/mp4')
        ->and($result['filename'])->toBe('ytdlp_dl_abc123.mp4')
        ->and($result['content_length'])->toBe(11)
        ->and(is_resource($result['stream']))->toBeTrue();

    rewind($result['stream']);
    expect(stream_get_contents($result['stream']))->toBe('binary-body');

    Http::assertSent(function ($request) {
        return $request->url() === 'http://localhost:8000/yt-dlp/download'
            && $request['url'] === 'https://example.com/watch?v=1'
            && $request['format_id'] === '18'
            && $request['audio_only'] === false;
    });
});

it('downloadStream falls back to a default filename when the header is missing', function () {
    Http::fake([
        'http://localhost:8000/yt-dlp/download' => Http::response('binary-body', 200, [
            'Content-Type' => 'video/mp4',
        ]),
    ]);

    $client = new YtDlpClient('http://localhost:8000', 'test-token');
    $result = $client->downloadStream('https://example.com', '18', false);

    expect($result['filename'])->toBe('ytdlp_dl.mp4');
});

it('downloadStream marks audio_only true in the request body', function () {
    Http::fake([
        'http://localhost:8000/yt-dlp/download' => Http::response('x', 200, [
            'Content-Type' => 'audio/mp4',
            'Content-Disposition' => 'attachment; filename="ytdlp_dl_abc.m4a"',
        ]),
    ]);

    $client = new YtDlpClient('http://localhost:8000', 'test-token');
    $client->downloadStream('https://example.com', '140', true);

    Http::assertSent(fn ($request) => $request['audio_only'] === true);
});
