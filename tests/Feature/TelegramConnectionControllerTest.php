<?php

use App\Enums\CloudProvider;
use App\Enums\ConnectionStatus;
use App\Models\CloudConnection;
use App\Models\User;
use App\Services\CloudStorage\CloudStorageCache;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Session;

uses(RefreshDatabase::class);

beforeEach(function () {
    config(['services.python-service.url' => 'http://localhost:8000']);
    config(['services.python-service.token' => 'test-token']);
});

it('validates name and phone on requestCode', function () {
    $user = User::factory()->create();

    $response = $this->actingAs($user)->postJson('/connections/telegram/request-code', []);

    $response->assertUnprocessable();
    $response->assertJsonValidationErrors(['name', 'phone']);
});

it('sends code request to microservice and stores session', function () {
    Http::preventStrayRequests();
    Http::fake([
        'http://localhost:8000/request-code' => Http::response([
            'success' => true,
            'phone_code_hash' => 'hash123',
        ]),
    ]);

    $user = User::factory()->create();

    $response = $this->actingAs($user)->postJson('/connections/telegram/request-code', [
        'name' => 'My Telegram',
        'phone' => '+84912345678',
    ]);

    $response->assertOk();
    $response->assertJson(['success' => true]);

    $session = session('telegram_connect');
    expect($session)->not()->toBeNull()
        ->and($session['session_id'])->toBeString()
        ->and($session['name'])->toBe('My Telegram')
        ->and($session['phone'])->toBe('+84912345678');
});

it('validates code on store', function () {
    $user = User::factory()->create();
    Session::put('telegram_connect', [
        'session_id' => 'sess123',
        'name' => 'My Telegram',
        'phone' => '+84912345678',
        'phone_code_hash' => 'hash123',
    ]);

    $response = $this->actingAs($user)->postJson('/connections/telegram', []);

    $response->assertUnprocessable();
    $response->assertJsonValidationErrors(['code']);
});

it('handles password_required response', function () {
    Http::preventStrayRequests();
    Http::fake([
        'http://localhost:8000/login' => Http::response([
            'success' => false,
            'password_required' => true,
            'message' => '2FA password required.',
        ]),
    ]);

    $user = User::factory()->create();
    Session::put('telegram_connect', [
        'session_id' => 'sess123',
        'name' => 'My Telegram',
        'phone' => '+84912345678',
        'phone_code_hash' => 'hash123',
    ]);

    $response = $this->actingAs($user)->postJson('/connections/telegram', [
        'code' => '12345',
    ]);

    $response->assertOk();
    $response->assertJson(['password_required' => true]);
});

it('creates CloudConnection on successful login', function () {
    Http::preventStrayRequests();
    Http::fake([
        'http://localhost:8000/login' => Http::response([
            'success' => true,
            'message' => 'Login successful',
            'synced' => 42,
        ]),
    ]);

    $user = User::factory()->create();
    Session::put('telegram_connect', [
        'session_id' => 'sess123',
        'name' => 'My Telegram',
        'phone' => '+84912345678',
        'phone_code_hash' => 'hash123',
    ]);

    $response = $this->actingAs($user)->postJson('/connections/telegram', [
        'code' => '12345',
    ]);

    $response->assertOk();
    $response->assertJson(['success' => true, 'synced' => 42]);

    $this->assertDatabaseHas('cloud_connections', [
        'name' => 'My Telegram',
        'provider' => CloudProvider::TELEGRAM,
        'status' => ConnectionStatus::CONNECTED,
    ]);

    $connection = $user->cloudConnections()->first();
    expect($connection->credentials)->toBe(['session_id' => 'sess123']);
    expect(Session::has('telegram_connect'))->toBeFalse();
});

it('rejects request with expired session', function () {
    $user = User::factory()->create();

    $response = $this->actingAs($user)->postJson('/connections/telegram', [
        'code' => '12345',
    ]);

    $response->assertStatus(422);
    $response->assertJson(['message' => 'Session expired. Please start over.']);
});

it('flushes connection cache after successful telegram sync', function () {
    Http::preventStrayRequests();
    Http::fake([
        'http://localhost:8000/sync' => Http::response([
            'success' => true,
            'added' => 5,
        ]),
    ]);

    $user = User::factory()->create();
    $connection = CloudConnection::create([
        'user_id' => $user->id,
        'name' => 'My Telegram',
        'provider' => CloudProvider::TELEGRAM,
        'credentials' => ['session_id' => 'sess123'],
        'status' => ConnectionStatus::CONNECTED,
    ]);

    $cache = Mockery::mock(CloudStorageCache::class);
    $cache->shouldReceive('flushConnection')
        ->once()
        ->with(Mockery::on(fn (CloudConnection $c): bool => $c->id === $connection->id));
    app()->instance(CloudStorageCache::class, $cache);

    $response = $this->actingAs($user)->post("/connections/{$connection->id}/telegram/sync");

    $response->assertRedirect();
    $response->assertSessionHas('success', 'Synced 5 item(s) from Telegram.');
});
