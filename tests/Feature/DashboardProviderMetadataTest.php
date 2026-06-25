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
    $this->withoutVite();

    $user = User::factory()->create([
        'email_verified_at' => now(),
    ]);

    $googleConnector = Mockery::mock(CloudProviderConnector::class);
    $googleConnector->shouldReceive('provider')->andReturn(CloudProvider::GOOGLE_DRIVE);
    $googleConnector->shouldReceive('capabilities')->andReturn(new ProviderCapabilities(
        browse: true,
        upload: true,
        download: true,
        delete: true,
        createFolder: true,
        share: true,
        move: false,
    ));

    $oneDriveConnector = Mockery::mock(CloudProviderConnector::class);
    $oneDriveConnector->shouldReceive('provider')->andReturn(CloudProvider::ONEDRIVE);
    $oneDriveConnector->shouldReceive('capabilities')->andReturn(new ProviderCapabilities(
        browse: true,
        upload: true,
        download: true,
        delete: true,
        createFolder: true,
        share: false,
        move: false,
    ));

    $dropboxConnector = Mockery::mock(CloudProviderConnector::class);
    $dropboxConnector->shouldReceive('provider')->andReturn(CloudProvider::DROPBOX);
    $dropboxConnector->shouldReceive('capabilities')->andReturn(new ProviderCapabilities(
        browse: true,
        upload: true,
        download: true,
        delete: true,
        createFolder: true,
        share: false,
        move: false,
    ));

    $ftpConnector = Mockery::mock(CloudProviderConnector::class);
    $ftpConnector->shouldReceive('provider')->andReturn(CloudProvider::FTP);
    $ftpConnector->shouldReceive('capabilities')->andReturn(new ProviderCapabilities(
        browse: true,
        upload: true,
        download: true,
        delete: true,
        createFolder: true,
        share: false,
        move: false,
    ));

    $manager = Mockery::mock(CloudStorageManager::class);
    $manager->shouldReceive('connectors')->once()->andReturn([
        $googleConnector,
        $oneDriveConnector,
        $dropboxConnector,
        $ftpConnector,
    ]);

    $this->app->instance(CloudStorageManager::class, $manager);

    $response = $this->actingAs($user)->get(route('dashboard'));

    $response
        ->assertOk()
        ->assertInertia(fn (Assert $page): Assert => $page
            ->component('dashboard')
            ->has('availableProviders', 4)
            ->where('availableProviders.0.key', 'google-drive')
            ->where('availableProviders.0.label', 'Google Drive')
            ->where('availableProviders.0.value', CloudProvider::GOOGLE_DRIVE)
            ->where('availableProviders.0.icon', '/assets/svg/GoogleDrive.svg')
            ->where('availableProviders.0.status', 'active')
            ->where('availableProviders.0.authType', 'oauth')
            ->where('availableProviders.0.redirectUrl', route('oauth.redirect', ['provider' => 'google-drive']))
            ->where('availableProviders.0.capabilities', [
                'browse' => true,
                'upload' => true,
                'download' => true,
                'delete' => true,
                'createFolder' => true,
                'share' => true,
                'move' => false,
            ])
            ->where('availableProviders.1.key', 'onedrive')
            ->where('availableProviders.1.label', 'OneDrive')
            ->where('availableProviders.1.value', CloudProvider::ONEDRIVE)
            ->where('availableProviders.1.icon', '/assets/svg/OneDrive.svg')
            ->where('availableProviders.1.status', 'active')
            ->where('availableProviders.1.authType', 'oauth')
            ->where('availableProviders.1.redirectUrl', route('oauth.redirect', ['provider' => 'onedrive']))
            ->where('availableProviders.1.capabilities', [
                'browse' => true,
                'upload' => true,
                'download' => true,
                'delete' => true,
                'createFolder' => true,
                'share' => false,
                'move' => false,
            ])
            ->where('availableProviders.2.key', 'dropbox')
            ->where('availableProviders.2.label', 'Dropbox')
            ->where('availableProviders.2.value', CloudProvider::DROPBOX)
            ->where('availableProviders.2.icon', '/assets/svg/Dropbox.svg')
            ->where('availableProviders.2.status', 'active')
            ->where('availableProviders.2.authType', 'oauth')
            ->where('availableProviders.2.redirectUrl', route('oauth.redirect', ['provider' => 'dropbox']))
            ->where('availableProviders.2.capabilities', [
                'browse' => true,
                'upload' => true,
                'download' => true,
                'delete' => true,
                'createFolder' => true,
                'share' => false,
                'move' => false,
            ])
            ->where('availableProviders.3.key', 'ftp')
            ->where('availableProviders.3.label', 'FTP Server')
            ->where('availableProviders.3.value', CloudProvider::FTP)
            ->where('availableProviders.3.icon', '/assets/svg/Ftp.svg')
            ->where('availableProviders.3.status', 'active')
            ->where('availableProviders.3.authType', 'credentials')
            ->where('availableProviders.3.redirectUrl', null)
            ->where('availableProviders.3.capabilities', [
                'browse' => true,
                'upload' => true,
                'download' => true,
                'delete' => true,
                'createFolder' => true,
                'share' => false,
                'move' => false,
            ])
            ->has('connections')
        );
});

it('marks sftp as a credential based provider', function () {
    $user = User::factory()->create();

    $response = $this->actingAs($user)->get('/dashboard');

    $providers = collect($response->viewData('page')['props']['availableProviders']);
    $sftp = $providers->firstWhere('key', 'sftp');

    expect($sftp)->not->toBeNull()
        ->and($sftp['authType'])->toBe('credentials')
        ->and($sftp['redirectUrl'])->toBeNull();
});
