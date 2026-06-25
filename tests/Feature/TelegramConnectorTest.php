<?php

use App\Data\ProviderCapabilities;
use App\Enums\CloudProvider;
use App\Enums\ConnectionStatus;
use App\Models\CloudConnection;
use App\Models\User;
use App\Services\CloudStorage\CloudProviderRegistry;
use App\Services\CloudStorage\Connectors\TelegramConnector;
use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;

uses(RefreshDatabase::class);

function telegramConnection(array $credentials = []): CloudConnection
{
    $user = User::factory()->create();

    return $user->cloudConnections()->create([
        'provider' => CloudProvider::TELEGRAM,
        'provider_id' => 'telegram-sess1',
        'name' => 'Telegram Storage',
        'credentials' => array_merge(['session_id' => 'sess1'], $credentials),
        'status' => ConnectionStatus::CONNECTED,
    ]);
}

it('returns TELEGRAM provider', function () {
    $connector = new TelegramConnector;

    expect($connector->provider() === CloudProvider::TELEGRAM)->toBeTrue();
});

it('returns correct capabilities', function () {
    $connector = new TelegramConnector;
    $caps = $connector->capabilities();

    expect($caps)->toBeInstanceOf(ProviderCapabilities::class)
        ->and($caps->browse)->toBeTrue()
        ->and($caps->upload)->toBeTrue()
        ->and($caps->download)->toBeTrue()
        ->and($caps->delete)->toBeTrue()
        ->and($caps->createFolder)->toBeFalse()
        ->and($caps->share)->toBeTrue();
});

it('builds a filesystem disk from connection', function () {
    Http::preventStrayRequests();

    $connection = telegramConnection();
    $connector = new TelegramConnector;
    $disk = $connector->disk($connection);

    expect($disk)->toBeInstanceOf(Filesystem::class);
});

it('returns empty redirect url', function () {
    $connector = new TelegramConnector;

    expect($connector->redirectUrl())->toBe('');
});

it('is registered in the provider registry', function () {
    $registry = app(CloudProviderRegistry::class);
    $connector = $registry->for(CloudProvider::TELEGRAM);

    expect($connector)->toBeInstanceOf(TelegramConnector::class);
});

it('uses enum constants consistently for telegram connections', function () {
    expect(CloudProvider::TELEGRAM->value)->toBe(7)
        ->and(telegramConnection()->provider === CloudProvider::TELEGRAM)->toBeTrue();
});
