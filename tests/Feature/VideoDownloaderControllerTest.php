<?php

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Inertia\Testing\AssertableInertia;

uses(RefreshDatabase::class);

const VD_TEST_URL = 'https://example.com/watch?v=1';

beforeEach(function () {
    config(['services.python-service.url' => 'http://localhost:8000']);
    config(['services.python-service.token' => 'test-token']);
});

it('renders the video downloader page for authenticated users', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->get(route('video-downloader.index'))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('video-downloader/index')
        );
});

it('requires authentication to render the page', function () {
    $this->get(route('video-downloader.index'))->assertRedirect(route('login'));
});

it('returns the unwrapped metadata when the microservice succeeds', function () {
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
                'webpage_url' => VD_TEST_URL,
                'formats' => [
                    ['format_id' => '18', 'ext' => 'mp4', 'resolution' => '640x360', 'filesize' => 1000, 'vcodec' => 'avc1', 'acodec' => 'mp4a', 'tbr' => 200.0, 'format_note' => '360p'],
                ],
            ],
        ]),
    ]);

    $user = User::factory()->create();

    $this->actingAs($user)
        ->postJson(route('video-downloader.metadata'), [
            'url' => VD_TEST_URL,
        ])
        ->assertOk()
        ->assertJson(['title' => 'Sample']);
});

it('returns 422 when the url is missing', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->postJson(route('video-downloader.metadata'), [])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['url']);
});

it('rejects private network urls for metadata requests', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->postJson(route('video-downloader.metadata'), [
            'url' => 'http://127.0.0.1/metadata',
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['url']);
});

it('returns 502 when the microservice fails', function () {
    Http::fake([
        'http://localhost:8000/yt-dlp/metadata' => Http::response(['boom' => true], 500),
    ]);

    $user = User::factory()->create();

    $this->actingAs($user)
        ->postJson(route('video-downloader.metadata'), [
            'url' => VD_TEST_URL,
        ])
        ->assertStatus(502)
        ->assertJson(['message' => 'Could not fetch video metadata.']);
});

it('streams the downloaded file with the original Content-Disposition filename', function () {
    Http::fake([
        'http://localhost:8000/yt-dlp/download' => Http::response('binary-body', 200, [
            'Content-Type' => 'video/mp4',
            'Content-Disposition' => 'attachment; filename="ytdlp_dl_abc.mp4"',
        ]),
    ]);

    $user = User::factory()->create();

    $this->actingAs($user)
        ->get(route('video-downloader.download', [
            'url' => VD_TEST_URL,
            'format_id' => '18',
        ]))
        ->assertOk()
        ->assertHeader('Content-Type', 'video/mp4')
        ->assertHeader('Content-Disposition', 'attachment; filename="ytdlp_dl_abc.mp4"');
});

it('returns 422 when the download url is missing', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->getJson(route('video-downloader.download', ['format_id' => '18']))
        ->assertUnprocessable();
});

it('returns 502 when the download request fails', function () {
    Http::fake([
        'http://localhost:8000/yt-dlp/download' => Http::response(['boom' => true], 500),
    ]);

    $user = User::factory()->create();

    $this->actingAs($user)
        ->getJson(route('video-downloader.download', [
            'url' => VD_TEST_URL,
            'format_id' => '18',
        ]))
        ->assertStatus(502);
});
