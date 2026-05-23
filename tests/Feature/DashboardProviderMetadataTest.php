<?php

use App\Data\ProviderCapabilities;
use App\Enums\CloudProvider;
use App\Models\User;
use App\Services\CloudStorage\CloudStorageManager;
use App\Services\CloudStorage\Contracts\CloudProviderConnector;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;

uses(RefreshDatabase::class);

it('provides available cloud provider metadata to the dashboard', function () {
    $user = User::factory()->create([
        'email_verified_at' => now(),
    ]);

    $googleConnector = Mockery::mock(CloudProviderConnector::class);
    $googleConnector->shouldReceive('provider')->andReturn(CloudProvider::GOOGLE_DRIVE());
    $googleConnector->shouldReceive('capabilities')->andReturn(new ProviderCapabilities(
        browse: true,
        upload: true,
        download: true,
        delete: true,
        createFolder: true,
        share: true,
    ));

    $oneDriveConnector = Mockery::mock(CloudProviderConnector::class);
    $oneDriveConnector->shouldReceive('provider')->andReturn(CloudProvider::ONEDRIVE());
    $oneDriveConnector->shouldReceive('capabilities')->andReturn(new ProviderCapabilities(
        browse: true,
        upload: true,
        download: true,
        delete: true,
        createFolder: true,
        share: false,
    ));

    $manager = Mockery::mock(CloudStorageManager::class);
    $manager->shouldReceive('connectors')->once()->andReturn([
        $googleConnector,
        $oneDriveConnector,
    ]);

    $this->app->instance(CloudStorageManager::class, $manager);

    $response = $this->actingAs($user)->get(route('dashboard'));

    $response
        ->assertOk()
        ->assertInertia(fn (Assert $page): Assert => $page
            ->component('dashboard')
            ->has('availableProviders', 2)
            ->where('availableProviders.0.key', 'google-drive')
            ->where('availableProviders.0.label', 'Google Drive')
            ->where('availableProviders.0.value', CloudProvider::GOOGLE_DRIVE)
            ->where('availableProviders.0.icon', '/assets/svg/GoogleDrive.svg')
            ->where('availableProviders.0.status', 'active')
            ->where('availableProviders.0.redirectUrl', route('oauth.redirect', ['provider' => 'google-drive']))
            ->where('availableProviders.0.capabilities', [
                'browse' => true,
                'upload' => true,
                'download' => true,
                'delete' => true,
                'createFolder' => true,
                'share' => true,
            ])
            ->where('availableProviders.1.key', 'onedrive')
            ->where('availableProviders.1.label', 'OneDrive')
            ->where('availableProviders.1.value', CloudProvider::ONEDRIVE)
            ->where('availableProviders.1.icon', '/assets/svg/OneDrive.svg')
            ->where('availableProviders.1.status', 'active')
            ->where('availableProviders.1.redirectUrl', route('oauth.redirect', ['provider' => 'onedrive']))
            ->where('availableProviders.1.capabilities', [
                'browse' => true,
                'upload' => true,
                'download' => true,
                'delete' => true,
                'createFolder' => true,
                'share' => false,
            ])
            ->has('connections')
        );
});
