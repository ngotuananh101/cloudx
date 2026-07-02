<?php

use App\Models\ActivityLog;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

it('requires authentication', function () {
    $this->get(route('system.activity-logs.index'))
        ->assertRedirect(route('login'));
});

it('renders the activity log page for the current user', function () {
    $this->withoutVite();

    $user = User::factory()->create();

    $log = ActivityLog::factory()->for($user)->create([
        'subject_name' => 'report.pdf',
    ]);

    $this->actingAs($user)
        ->get(route('system.activity-logs.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page): Assert => $page
            ->component('system/activity-logs/index')
            ->has('logs.data', 1)
            ->where('logs.data.0.id', $log->id)
            ->where('logs.data.0.subject_name', 'report.pdf')
            ->where('retentionDays', 90)
        );
});

it('only shows logs owned by the current user', function () {
    $this->withoutVite();

    $user = User::factory()->create();
    $otherUser = User::factory()->create();

    ActivityLog::factory()->for($otherUser)->create();

    $this->actingAs($user)
        ->get(route('system.activity-logs.index'))
        ->assertInertia(fn (Assert $page): Assert => $page
            ->has('logs.data', 0)
        );
});

it('excludes logs older than 90 days', function () {
    $this->withoutVite();

    $user = User::factory()->create();

    ActivityLog::factory()->for($user)->create([
        'created_at' => now()->subDays(91),
    ]);

    $recent = ActivityLog::factory()->for($user)->create([
        'created_at' => now()->subDays(10),
    ]);

    $this->actingAs($user)
        ->get(route('system.activity-logs.index'))
        ->assertInertia(fn (Assert $page): Assert => $page
            ->has('logs.data', 1)
            ->where('logs.data.0.id', $recent->id)
        );
});
