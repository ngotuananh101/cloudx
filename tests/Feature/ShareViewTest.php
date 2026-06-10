<?php

use App\Models\CloudConnection;
use App\Models\CloudShare;
use App\Models\User;
use App\Services\CloudStorage\CloudFileBrowser;
use App\Services\CloudStorage\PathEncoder;
use Illuminate\Support\Facades\Hash;
use Inertia\Testing\AssertableInertia;

it('renders error page when share is not found', function () {
    $this->get(route('share.view', ['uuid' => 'nonexistent-uuid']))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('share/error')
            ->where('reason', 'not_found')
        );
});

it('renders error page when share has expired', function () {
    $user = User::factory()->create();
    $connection = CloudConnection::factory()->create(['user_id' => $user->id]);

    CloudShare::create([
        'uuid' => 'expired-uuid',
        'user_id' => $user->id,
        'cloud_connection_id' => $connection->id,
        'path' => 'file.txt',
        'name' => 'file.txt',
        'is_directory' => false,
        'type' => 'public',
        'expires_at' => now()->subDay(),
    ]);

    $this->get(route('share.view', ['uuid' => 'expired-uuid']))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('share/error')
            ->where('reason', 'expired')
        );
});

it('renders password page when share is password protected and not verified', function () {
    $user = User::factory()->create();
    $connection = CloudConnection::factory()->create(['user_id' => $user->id]);

    CloudShare::create([
        'uuid' => 'locked-uuid',
        'user_id' => $user->id,
        'cloud_connection_id' => $connection->id,
        'path' => 'secret.pdf',
        'name' => 'secret.pdf',
        'is_directory' => false,
        'type' => 'password',
        'password' => Hash::make('mypass'),
    ]);

    $this->get(route('share.view', ['uuid' => 'locked-uuid']))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('share/password')
            ->where('uuid', 'locked-uuid')
            ->where('share.name', 'secret.pdf')
        );
});

it('renders view page for public file share', function () {
    $user = User::factory()->create();
    $connection = CloudConnection::factory()->create(['user_id' => $user->id]);

    CloudShare::create([
        'uuid' => 'public-uuid',
        'user_id' => $user->id,
        'cloud_connection_id' => $connection->id,
        'path' => 'report.pdf',
        'name' => 'report.pdf',
        'is_directory' => false,
        'type' => 'public',
    ]);

    $this->get(route('share.view', ['uuid' => 'public-uuid']))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('share/view')
            ->where('share.uuid', 'public-uuid')
            ->where('share.name', 'report.pdf')
            ->where('isDirectory', false)
            ->has('file')
            ->where('file.name', 'report.pdf')
        );
});

it('renders view page for public folder share with file listing', function () {
    $user = User::factory()->create();
    $connection = CloudConnection::factory()->create(['user_id' => $user->id]);

    CloudShare::create([
        'uuid' => 'folder-uuid',
        'user_id' => $user->id,
        'cloud_connection_id' => $connection->id,
        'path' => 'Projects',
        'name' => 'Projects',
        'is_directory' => true,
        'type' => 'public',
    ]);

    $browser = Mockery::mock(CloudFileBrowser::class);
    $browser->shouldReceive('list')->andReturn([
        [
            'id' => 'Projects/readme.md',
            'path' => 'Projects/readme.md',
            'name' => 'readme.md',
            'type' => 'document',
            'size' => 512,
            'updatedAt' => 'Jun 8, 2026',
            'isDirectory' => false,
        ],
        [
            'id' => 'Projects/src',
            'path' => 'Projects/src',
            'name' => 'src',
            'type' => 'folder',
            'size' => 0,
            'updatedAt' => '--',
            'isDirectory' => true,
        ],
    ]);
    $this->app->instance(CloudFileBrowser::class, $browser);

    $this->get(route('share.view', ['uuid' => 'folder-uuid']))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('share/view')
            ->where('share.uuid', 'folder-uuid')
            ->where('isDirectory', true)
            ->has('files', 2)
            ->where('currentPath', 'Projects')
        );
});

it('renders folder subfolder when path query param is provided', function () {
    $user = User::factory()->create();
    $connection = CloudConnection::factory()->create(['user_id' => $user->id]);

    CloudShare::create([
        'uuid' => 'folder-uuid',
        'user_id' => $user->id,
        'cloud_connection_id' => $connection->id,
        'path' => 'Projects',
        'name' => 'Projects',
        'is_directory' => true,
        'type' => 'public',
    ]);

    $browser = Mockery::mock(CloudFileBrowser::class);
    $browser->shouldReceive('list')->andReturn([
        [
            'id' => 'Projects/src/index.ts',
            'path' => 'Projects/src/index.ts',
            'name' => 'index.ts',
            'type' => 'code',
            'size' => 256,
            'updatedAt' => 'Jun 9, 2026',
            'isDirectory' => false,
        ],
    ]);
    $this->app->instance(CloudFileBrowser::class, $browser);

    $encodedPath = PathEncoder::encode('Projects/src');

    $this->get(route('share.view', ['uuid' => 'folder-uuid', 'path' => $encodedPath]))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('share/view')
            ->where('isDirectory', true)
            ->has('files', 1)
            ->where('currentPath', 'Projects/src')
        );
});
