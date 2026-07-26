<?php

// tests/Unit/QueueRetryAfterConfigTest.php
use Tests\TestCase;

uses(TestCase::class);

it('sets queue retry_after at least as long as the longest upload job timeout', function () {
    $redisRetry = (int) config('queue.connections.redis.retry_after');
    $databaseRetry = (int) config('queue.connections.database.retry_after');

    // RemoteUploadCloudTaskFileJob::$timeout = 1500
    expect($redisRetry)->toBeGreaterThanOrEqual(2100)
        ->and($databaseRetry)->toBeGreaterThanOrEqual(2100);
});
