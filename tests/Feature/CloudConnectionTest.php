<?php

use App\Enums\CloudProvider;
use App\Enums\ConnectionStatus;
use App\Models\CloudConnection;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;

uses(RefreshDatabase::class);

it('creates a cloud connection and casts attributes correctly', function () {
    $user = User::factory()->create();

    $credentials = ['access_token' => 'test_token', 'refresh_token' => 'refresh'];

    $connection = CloudConnection::create([
        'user_id' => $user->id,
        'name' => 'My Google Drive',
        'provider' => CloudProvider::GOOGLE_DRIVE,
        'credentials' => $credentials,
        'status' => ConnectionStatus::CONNECTED,
        'total_space' => 15000000000,
        'used_space' => 5000000000,
    ]);

    // Check relationship
    expect($connection->user->id)->toBe($user->id);

    // Check enums
    expect($connection->provider->value)->toBe(CloudProvider::GOOGLE_DRIVE)
        ->and($connection->status->value)->toBe(ConnectionStatus::CONNECTED);

    // Check credentials casting (it should return array in PHP)
    expect($connection->credentials)->toBeArray()
        ->and($connection->credentials['access_token'])->toBe('test_token');

    // Verify it is actually encrypted in the database
    $rawRecord = DB::table('cloud_connections')->where('id', $connection->id)->first();

    // The raw string in database should not be a raw JSON containing 'test_token'
    expect($rawRecord->credentials)->not->toContain('test_token');
});
