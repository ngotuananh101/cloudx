<?php

use App\Enums\CloudTaskStatus;
use App\Enums\CloudTaskType;
use App\Models\CloudConnection;
use App\Models\CloudTask;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

it('requires authentication', function () {
    $this->get(route('system.cloud-tasks.index'))
        ->assertRedirect(route('login'));
});

it('renders the system cloud tasks page for verified users', function () {
    $user = User::factory()->create();
    $connection = CloudConnection::factory()->for($user)->create([
        'name' => 'Work Drive',
    ]);

    $task = CloudTask::factory()
        ->for($user)
        ->for($connection, 'connection')
        ->create([
            'name' => 'proposal.pdf',
            'target_path' => 'documents',
            'type' => CloudTaskType::Upload,
            'status' => CloudTaskStatus::Completed,
            'completed_at' => now(),
        ]);

    $this->actingAs($user)
        ->get(route('system.cloud-tasks.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page): Assert => $page
            ->component('system/cloud-tasks/index')
            ->has('tasks.data', 1)
            ->where('tasks.data.0.id', $task->id)
            ->where('tasks.data.0.name', 'proposal.pdf')
            ->where('tasks.data.0.target_path', 'documents')
            ->where('tasks.data.0.connection.name', 'Work Drive')
            ->where('tasks.data.0.type.value', CloudTaskType::Upload)
            ->where('tasks.data.0.type.key', 'Upload')
            ->where('tasks.data.0.type.label', 'Upload')
            ->where('tasks.data.0.status.value', CloudTaskStatus::Completed)
            ->where('tasks.data.0.status.key', 'Completed')
            ->where('tasks.data.0.status.label', 'Completed')
        );
});

it('only shows tasks owned by the current user', function () {
    $user = User::factory()->create();
    $otherUser = User::factory()->create();

    $visibleTask = CloudTask::factory()->for($user)->create([
        'name' => 'visible-task.txt',
    ]);

    CloudTask::factory()->for($otherUser)->create([
        'name' => 'hidden-task.txt',
    ]);

    $this->actingAs($user)
        ->get(route('system.cloud-tasks.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page): Assert => $page
            ->has('tasks.data', 1)
            ->where('tasks.data.0.id', $visibleTask->id)
            ->where('tasks.data.0.name', 'visible-task.txt')
        );
});

it('orders newest tasks first', function () {
    $user = User::factory()->create();

    $olderTask = CloudTask::factory()->for($user)->create([
        'name' => 'older-task.txt',
        'created_at' => now()->subDay(),
    ]);

    $newerTask = CloudTask::factory()->for($user)->create([
        'name' => 'newer-task.txt',
        'created_at' => now(),
    ]);

    $this->actingAs($user)
        ->get(route('system.cloud-tasks.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page): Assert => $page
            ->where('tasks.data.0.id', $newerTask->id)
            ->where('tasks.data.1.id', $olderTask->id)
        );
});

it('paginates tasks for inertia infinite scroll', function () {
    $user = User::factory()->create();

    CloudTask::factory()
        ->count(25)
        ->for($user)
        ->sequence(fn ($sequence): array => [
            'name' => "task-{$sequence->index}",
            'created_at' => now()->subMinutes($sequence->index),
        ])
        ->create();

    $this->actingAs($user)
        ->get(route('system.cloud-tasks.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page): Assert => $page
            ->has('tasks.data', 20)
        );

    $this->actingAs($user)
        ->get(route('system.cloud-tasks.index', ['page' => 2]))
        ->assertOk()
        ->assertInertia(fn (Assert $page): Assert => $page
            ->has('tasks.data', 5)
        );
});
