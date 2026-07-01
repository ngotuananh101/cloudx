<?php

declare(strict_types=1);

namespace App\Services\CloudStorage\Connectors;

use App\Data\ConnectedAccountData;
use App\Data\ProviderCapabilities;
use App\Enums\CloudProvider;
use App\Models\CloudConnection;
use App\Services\CloudStorage\Contracts\CloudProviderConnector;
use App\Services\Telegram\TelegramAdapter;
use App\Services\Telegram\TelegramClient;
use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Filesystem\FilesystemAdapter;
use Illuminate\Http\Request;
use League\Flysystem\Filesystem as Flysystem;
use LogicException;

class TelegramConnector implements CloudProviderConnector
{
    public function provider(): CloudProvider
    {
        return CloudProvider::TELEGRAM;
    }

    public function redirectUrl(): string
    {
        return '';
    }

    public function handleCallback(Request $request): ConnectedAccountData
    {
        throw new LogicException('Telegram connections are credential-based and do not support OAuth callbacks.');
    }

    public function disk(CloudConnection $connection): Filesystem
    {
        $credentials = $connection->credentials;

        $client = new TelegramClient(
            url: (string) config('services.python-service.url'),
            token: (string) config('services.python-service.token'),
            sessionId: (string) ($credentials['session_id'] ?? ''),
        );

        $adapter = new TelegramAdapter($client);

        return new FilesystemAdapter(
            new Flysystem($adapter),
            $adapter,
            [],
        );
    }

    public function capabilities(): ProviderCapabilities
    {
        return new ProviderCapabilities(
            browse: true,
            upload: true,
            download: true,
            delete: true,
            createFolder: false,
            share: true,
            move: false,
        );
    }
}
