<?php

use App\Enums\CloudProvider;
use App\Enums\ConnectionStatus;
use App\Models\CloudConnection;
use App\Models\CloudShare;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('stores file size in extra_info when sharing a single file', function () {
    $user = User::factory()->create();
    $connection = CloudConnection::create([
        'user_id' => $user->id,
        'name' => 'My Drive',
        'provider' => CloudProvider::ONEDRIVE,
        'credentials' => ['access_token' => 'token'],
        'status' => ConnectionStatus::CONNECTED,
    ]);

    $this->actingAs($user)->post(
        route('connections.shares.store', ['connection' => $connection->id]),
        [
            'path' => 'docs/report.pdf',
            'name' => 'report.pdf',
            'is_directory' => false,
            'type' => 'public',
            'size' => 12345,
        ]
    )->assertRedirect();

    $share = CloudShare::firstOrFail();
    expect($share->extra_info)->toBe(['size' => 12345]);
});

it('does not store extra_info when sharing a directory', function () {
    $user = User::factory()->create();
    $connection = CloudConnection::create([
        'user_id' => $user->id,
        'name' => 'My Drive',
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
        'name' => 'My Drive',
        'provider' => CloudProvider::ONEDRIVE,
        'credentials' => ['access_token' => 'token'],
        'status' => ConnectionStatus::CONNECTED,
    ]);

    $this->actingAs($user)->post(
        route('connections.shares.store', ['connection' => $connection->id]),
        [
            'path' => 'docs/report.pdf',
            'name' => 'report.pdf',
            'is_directory' => false,
            'type' => 'public',
        ]
    )->assertRedirect();

    $share = CloudShare::firstOrFail();
    expect($share->extra_info)->toBeNull();
});
