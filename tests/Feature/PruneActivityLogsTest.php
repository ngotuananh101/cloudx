<?php

use App\Models\ActivityLog;
use App\Models\User;

it('deletes activity logs older than 90 days and keeps recent ones', function () {
    $user = User::factory()->create();

    $old = ActivityLog::factory()->for($user)->create([
        'created_at' => now()->subDays(91),
    ]);
    $boundary = ActivityLog::factory()->for($user)->create([
        'created_at' => now()->subDays(90)->subMinute(),
    ]);
    $recent = ActivityLog::factory()->for($user)->create([
        'created_at' => now()->subDays(10),
    ]);

    $this->artisan('app:prune-activity-logs')
        ->assertExitCode(0);

    expect(ActivityLog::query()->whereKey($old->id)->exists())->toBeFalse()
        ->and(ActivityLog::query()->whereKey($boundary->id)->exists())->toBeFalse()
        ->and(ActivityLog::query()->whereKey($recent->id)->exists())->toBeTrue();
});
