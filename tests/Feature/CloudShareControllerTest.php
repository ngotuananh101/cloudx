<?php

use App\Enums\ActivityAction;
use App\Enums\CloudProvider;
use App\Enums\ConnectionStatus;
use App\Models\ActivityLog;
use App\Models\CloudConnection;
use App\Models\CloudShare;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

const DRIVE_NAME = 'My Drive';
const SHARE_REPORT_PATH = 'docs/report.pdf';

it('stores file size in extra_info when sharing a single file', function () {
    $user = User::factory()->create();
    $connection = CloudConnection::create([
        'user_id' => $user->id,
        'name' => DRIVE_NAME,
        'provider' => CloudProvider::ONEDRIVE,
        'credentials' => ['access_token' => 'token'],
        'status' => ConnectionStatus::CONNECTED,
    ]);

    $this->actingAs($user)->post(
        route('connections.shares.store', ['connection' => $connection->id]),
        [
            'path' => SHARE_REPORT_PATH,
            'name' => 'report.pdf',
            'is_directory' => false,
            'type' => 'public',
            'size' => 12345,
        ]
    )->assertRedirect();

    $share = CloudShare::firstOrFail();
    expect($share->extra_info)->toBe(['size' => 12345]);

    $log = ActivityLog::query()->where('user_id', $user->id)->sole();
    expect($log->action)->toBe(ActivityAction::ShareCreated)
        ->and($log->subject_name)->toBe('report.pdf')
        ->and($log->cloud_connection_id)->toBe($connection->id);
});

it('logs the activity and removes the share when destroyed', function () {
    $user = User::factory()->create();
    $connection = CloudConnection::create([
        'user_id' => $user->id,
        'name' => DRIVE_NAME,
        'provider' => CloudProvider::ONEDRIVE,
        'credentials' => ['access_token' => 'token'],
        'status' => ConnectionStatus::CONNECTED,
    ]);
    $share = CloudShare::create([
        'uuid' => (string) Str::uuid(),
        'user_id' => $user->id,
        'cloud_connection_id' => $connection->id,
        'path' => SHARE_REPORT_PATH,
        'name' => 'report.pdf',
        'is_directory' => false,
        'type' => 'public',
    ]);

    $this->actingAs($user)->delete(
        route('connections.shares.destroy', ['connection' => $connection->id, 'share' => $share->id])
    )->assertRedirect();

    expect(CloudShare::query()->whereKey($share->id)->exists())->toBeFalse();

    $log = ActivityLog::query()->where('user_id', $user->id)->sole();
    expect($log->action)->toBe(ActivityAction::ShareDeleted)
        ->and($log->subject_name)->toBe('report.pdf');
});

it('does not store extra_info when sharing a directory', function () {
    $user = User::factory()->create();
    $connection = CloudConnection::create([
        'user_id' => $user->id,
        'name' => DRIVE_NAME,
        'provider' => CloudProvider::ONEDRIVE,
        'credentials' => ['access_token' => 'token'],
        'status' => ConnectionStatus::CONNECTED,
    ]);

    $this->actingAs($user)->post(
        route('connections.shares.store', ['connection' => $connection->id]),
        [
            'path' => 'Projects',
            'name' => 'Projects',
            'is_directory' => true,
            'type' => 'public',
            'size' => 99999,
        ]
    )->assertRedirect();

    $share = CloudShare::firstOrFail();
    expect($share->extra_info)->toBeNull();
});

it('accepts missing size for backwards compatibility with shares created before the column existed', function () {
    $user = User::factory()->create();
    $connection = CloudConnection::create([
        'user_id' => $user->id,
        'name' => DRIVE_NAME,
        'provider' => CloudProvider::ONEDRIVE,
        'credentials' => ['access_token' => 'token'],
        'status' => ConnectionStatus::CONNECTED,
    ]);

    $this->actingAs($user)->post(
        route('connections.shares.store', ['connection' => $connection->id]),
        [
            'path' => SHARE_REPORT_PATH,
            'name' => 'report.pdf',
            'is_directory' => false,
            'type' => 'public',
        ]
    )->assertRedirect();

    $share = CloudShare::firstOrFail();
    expect($share->extra_info)->toBeNull();
});

it('hides the password hash when listing shares for a path', function () {
    $user = User::factory()->create();
    $connection = CloudConnection::create([
        'user_id' => $user->id,
        'name' => DRIVE_NAME,
        'provider' => CloudProvider::ONEDRIVE,
        'credentials' => ['access_token' => 'token'],
        'status' => ConnectionStatus::CONNECTED,
    ]);

    CloudShare::create([
        'uuid' => (string) Str::uuid(),
        'user_id' => $user->id,
        'cloud_connection_id' => $connection->id,
        'path' => SHARE_REPORT_PATH,
        'name' => 'report.pdf',
        'is_directory' => false,
        'type' => 'password',
        'password' => bcrypt('secret-pass'),
    ]);

    $response = $this->actingAs($user)->getJson(
        route('connections.shares.index', ['connection' => $connection->id, 'path' => SHARE_REPORT_PATH])
    );

    $response->assertOk()
        ->assertJsonCount(1)
        ->assertJsonMissingPath('0.password');
});
