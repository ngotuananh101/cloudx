<?php

use App\Enums\ActivityAction;
use App\Models\ActivityLog;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

it('shows at most the 4 most recent activities on the dashboard', function () {
    $this->withoutVite();

    $user = User::factory()->create(['email_verified_at' => now()]);

    $activities = collect(range(1, 6))->map(fn (int $i): ActivityLog => ActivityLog::factory()->for($user)->create([
        'subject_name' => "file-{$i}.pdf",
        'created_at' => now()->subMinutes($i),
    ]));

    $this->actingAs($user)
        ->get(route('dashboard'))
        ->assertOk()
        ->assertInertia(fn (Assert $page): Assert => $page
            ->component('dashboard')
            ->has('recentActivities', 4)
            ->where('recentActivities.0.subject_name', 'file-1.pdf')
            ->where('recentActivities.3.subject_name', 'file-4.pdf')
        );

    expect($activities)->toHaveCount(6);
});

it('does not show other users activities on the dashboard', function () {
    $this->withoutVite();

    $user = User::factory()->create(['email_verified_at' => now()]);
    $otherUser = User::factory()->create();

    ActivityLog::factory()->for($otherUser)->create();

    $this->actingAs($user)
        ->get(route('dashboard'))
        ->assertOk()
        ->assertInertia(fn (Assert $page): Assert => $page
            ->component('dashboard')
            ->has('recentActivities', 0)
        );
});

it('serializes the activity action shape used by the frontend', function () {
    $this->withoutVite();

    $user = User::factory()->create(['email_verified_at' => now()]);

    ActivityLog::factory()->for($user)->create([
        'action' => ActivityAction::FileUploaded,
        'subject_name' => 'report.pdf',
        'target_name' => 'documents',
    ]);

    $this->actingAs($user)
        ->get(route('dashboard'))
        ->assertInertia(fn (Assert $page): Assert => $page
            ->where('recentActivities.0.action.key', 'FileUploaded')
            ->where('recentActivities.0.action.label', 'Uploaded')
            ->where('recentActivities.0.target_name', 'documents')
        );
});
