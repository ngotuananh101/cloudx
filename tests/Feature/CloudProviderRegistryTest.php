<?php

use App\Data\ConnectedAccountData;
use App\Data\ProviderCapabilities;
use App\Enums\CloudProvider;
use App\Models\CloudConnection;
use App\Services\CloudStorage\CloudProviderRegistry;
use App\Services\CloudStorage\CloudStorageManager;
use App\Services\CloudStorage\Contracts\CloudProviderConnector;
use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Http\Request;

it('resolves registered connectors by cloud provider', function () {
    $google = new FakeCloudProviderConnector(CloudProvider::GOOGLE_DRIVE);
    $oneDrive = new FakeCloudProviderConnector(CloudProvider::ONEDRIVE);

    $registry = new CloudProviderRegistry([$google, $oneDrive]);

    expect($registry->for(CloudProvider::GOOGLE_DRIVE))->toBe($google)
        ->and($registry->for(CloudProvider::ONEDRIVE))->toBe($oneDrive)
        ->and($registry->all())->toHaveCount(2);
});

it('throws when resolving an unsupported cloud provider', function () {
    $registry = new CloudProviderRegistry([
        new FakeCloudProviderConnector(CloudProvider::GOOGLE_DRIVE),
    ]);

    $registry->for(CloudProvider::ONEDRIVE);
})->throws(InvalidArgumentException::class);

it('delegates connector resolution through the cloud storage manager', function () {
    $google = new FakeCloudProviderConnector(CloudProvider::GOOGLE_DRIVE);
    $oneDrive = new FakeCloudProviderConnector(CloudProvider::ONEDRIVE);
    $registry = new CloudProviderRegistry([$google, $oneDrive]);

    $manager = new CloudStorageManager($registry);

    expect($manager->connector(CloudProvider::ONEDRIVE))->toBe($oneDrive)
        ->and($manager->connectors())->toHaveCount(2);
});

class FakeCloudProviderConnector implements CloudProviderConnector
{
    public function __construct(private CloudProvider $provider) {}

    public function provider(): CloudProvider
    {
        return $this->provider;
    }

    public function redirectUrl(): string
    {
        return 'https://example.com/oauth/redirect';
    }

    public function handleCallback(Request $request): ConnectedAccountData
    {
        return new ConnectedAccountData(
            providerId: 'fake-user',
            name: 'Fake Account',
            credentials: ['access_token' => 'fake-token'],
        );
    }

    public function disk(CloudConnection $connection): Filesystem
    {
        return app(Filesystem::class);
    }

    public function capabilities(): ProviderCapabilities
    {
        return new ProviderCapabilities(
            browse: true,
            upload: true,
            download: true,
            delete: true,
            createFolder: true,
            share: false,
        );
    }
}
