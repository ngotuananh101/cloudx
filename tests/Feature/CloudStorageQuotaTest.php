<?php

use App\Enums\CloudProvider;
use App\Enums\ConnectionStatus;
use App\Jobs\UpdateConnectionQuotaJob;
use App\Models\CloudConnection;
use App\Models\User;
use App\Services\CloudStorage\CloudStorageCache;
use App\Services\CloudStorage\CloudStorageQuota;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Bus;

uses(RefreshDatabase::class);

it('does not dispatch quota job if recently synced', function () {
    Bus::fake();

    $user = User::factory()->create();
    $connection = CloudConnection::create([
        'user_id' => $user->id,
        'name' => 'Google Drive',
        'provider' => CloudProvider::GOOGLE_DRIVE,
        'credentials' => ['access_token' => 'token'],
        'status' => ConnectionStatus::CONNECTED,
        'last_synced_at' => now()->subMinutes(5),
    ]);

    $quota = new CloudStorageQuota;
    $quota->refreshInBackground($connection);

    Bus::assertNotDispatched(UpdateConnectionQuotaJob::class);
});

it('dispatches quota job if last synced is old', function () {
    Bus::fake();

    $user = User::factory()->create();
    $connection = CloudConnection::create([
        'user_id' => $user->id,
        'name' => 'Google Drive',
        'provider' => CloudProvider::GOOGLE_DRIVE,
        'credentials' => ['access_token' => 'token'],
        'status' => ConnectionStatus::CONNECTED,
        'last_synced_at' => now()->subMinutes(15),
    ]);

    $quota = new CloudStorageQuota;
    $quota->refreshInBackground($connection);

    Bus::assertDispatched(UpdateConnectionQuotaJob::class);
});

it('delays flushQuota dispatch to prevent stampedes', function () {
    Bus::fake();

    $user = User::factory()->create();
    $connection = CloudConnection::create([
        'user_id' => $user->id,
        'name' => 'Google Drive',
        'provider' => CloudProvider::GOOGLE_DRIVE,
        'credentials' => ['access_token' => 'token'],
        'status' => ConnectionStatus::CONNECTED,
    ]);

    $cache = app(CloudStorageCache::class);
    $cache->flushQuota($connection);

    Bus::assertDispatched(UpdateConnectionQuotaJob::class, function ($job) {
        return $job->delay !== null;
    });
});

it('makes quota update jobs unique per connection for five minutes', function () {
    $user = User::factory()->create();
    $connection = CloudConnection::create([
        'user_id' => $user->id,
        'name' => 'Google Drive',
        'provider' => CloudProvider::GOOGLE_DRIVE,
        'credentials' => ['access_token' => 'token'],
        'status' => ConnectionStatus::CONNECTED,
    ]);

    $job = new UpdateConnectionQuotaJob($connection->id);

    expect($job)
        ->toBeInstanceOf(ShouldBeUnique::class)
        ->and($job->uniqueId())->toBe((string) $connection->id)
        ->and($job->uniqueFor)->toBe(300);
});
