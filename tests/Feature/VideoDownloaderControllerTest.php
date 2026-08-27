<?php

use App\Events\VideoDownloadJobUpdated;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
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
            ->has('savedCookies')
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

it('returns 502 when the microservice metadata fails', function () {
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

it('starts a background download job successfully', function () {
    Http::fake([
        'http://localhost:8000/yt-dlp/jobs' => Http::response([
            'job_id' => 'abc123hex',
            'status' => 'pending',
        ], 200),
    ]);

    $user = User::factory()->create();

    $this->actingAs($user)
        ->postJson(route('video-downloader.jobs.store'), [
            'url' => VD_TEST_URL,
            'format_id' => '18',
        ])
        ->assertOk()
        ->assertJson([
            'job_id' => 'abc123hex',
            'status' => 'pending',
        ]);
});

it('returns 422 when start job payload is invalid', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->postJson(route('video-downloader.jobs.store'), [
            'format_id' => '18',
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['url']);
});

it('returns 502 when starting download job fails on microservice', function () {
    Http::fake([
        'http://localhost:8000/yt-dlp/jobs' => Http::response(['boom' => true], 500),
    ]);

    $user = User::factory()->create();

    $this->actingAs($user)
        ->postJson(route('video-downloader.jobs.store'), [
            'url' => VD_TEST_URL,
            'format_id' => '18',
        ])
        ->assertStatus(502)
        ->assertJson(['message' => 'Could not start the video download.']);
});

it('returns job status correctly', function () {
    Http::fake([
        'http://localhost:8000/yt-dlp/jobs/abc123hex' => Http::response([
            'job_id' => 'abc123hex',
            'status' => 'downloading',
            'progress' => 55.4,
            'speed_str' => '3.2MiB/s',
            'eta_str' => '00:05',
            'filename' => 'video.mp4',
            'error' => '',
        ], 200),
    ]);

    $user = User::factory()->create();

    $this->actingAs($user)
        ->getJson(route('video-downloader.jobs.show', 'abc123hex'))
        ->assertOk()
        ->assertJson([
            'job_id' => 'abc123hex',
            'status' => 'downloading',
            'progress' => 55.4,
        ]);
});

it('returns 404 when job status is not found or expired', function () {
    Http::fake([
        'http://localhost:8000/yt-dlp/jobs/expired_id' => Http::response([
            'detail' => 'Job not found',
        ], 404),
    ]);

    $user = User::factory()->create();

    $this->actingAs($user)
        ->getJson(route('video-downloader.jobs.show', 'expired_id'))
        ->assertStatus(404)
        ->assertJson(['message' => 'Download job not found or expired.']);
});

it('streams the completed job file with Content-Disposition header', function () {
    Http::fake([
        'http://localhost:8000/yt-dlp/jobs/abc123hex/file' => Http::response('binary-video-stream', 200, [
            'Content-Type' => 'video/mp4',
            'Content-Disposition' => 'attachment; filename="my_cool_video.mp4"',
            'Content-Length' => '19',
        ]),
    ]);

    $user = User::factory()->create();

    $this->actingAs($user)
        ->get(route('video-downloader.jobs.download', 'abc123hex'))
        ->assertOk()
        ->assertHeader('Content-Type', 'video/mp4')
        ->assertHeader('Content-Disposition', 'attachment; filename="my_cool_video.mp4"; filename*=UTF-8\'\'my_cool_video.mp4');
});

it('returns 409 when job file is requested before ready', function () {
    Http::fake([
        'http://localhost:8000/yt-dlp/jobs/abc123hex/file' => Http::response([
            'detail' => 'File not ready',
        ], 409),
    ]);

    $user = User::factory()->create();

    $this->actingAs($user)
        ->get(route('video-downloader.jobs.download', 'abc123hex'))
        ->assertStatus(409);
});

it('broadcasts VideoDownloadJobUpdated event when progress webhook is called', function () {
    Event::fake();

    $user = User::factory()->create();

    $this->postJson(route('internal.video-downloader.progress', ['user_id' => $user->id]), [
        'job_id' => 'abc123hex',
        'status' => 'downloading',
        'progress' => 45.5,
        'speed_str' => '2.5MiB/s',
        'eta_str' => '00:10',
        'filename' => 'sample.mp4',
        'error' => '',
    ], ['X-Token' => 'test-token'])
        ->assertOk()
        ->assertJson(['success' => true]);

    Event::assertDispatched(VideoDownloadJobUpdated::class, function (VideoDownloadJobUpdated $event) use ($user) {
        return $event->userId === $user->id
            && $event->jobData['job_id'] === 'abc123hex'
            && $event->jobData['status'] === 'downloading'
            && $event->jobData['progress'] === 45.5;
    });
});

it('rejects progress webhook with invalid token', function () {
    $user = User::factory()->create();

    $this->postJson(route('internal.video-downloader.progress', ['user_id' => $user->id]), [
        'job_id' => 'abc123hex',
    ], ['X-Token' => 'wrong-token'])
        ->assertStatus(403);
});
