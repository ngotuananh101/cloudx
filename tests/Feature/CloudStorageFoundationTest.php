<?php

use App\Data\CloudFileData;
use App\Data\ConnectedAccountData;
use App\Data\ProviderCapabilities;
use App\Services\CloudStorage\CloudFileTypeDetector;
use App\Services\CloudStorage\PathEncoder;

it('encodes and decodes unicode cloud paths using url safe base64', function () {
    $path = 'Khách hàng/Ảnh hợp đồng.pdf';

    $encoded = PathEncoder::encode($path);

    expect($encoded)->not->toContain('+')
        ->and($encoded)->not->toContain('/')
        ->and($encoded)->not->toContain('=')
        ->and(PathEncoder::decode($encoded))->toBe($path);
});

it('returns empty string for invalid encoded paths', function () {
    expect(PathEncoder::decode('not valid ***'))->toBe('');
});

it('detects cloud file types from filename and directory flag', function () {
    expect(CloudFileTypeDetector::detect('Docs', true))->toBe('folder')
        ->and(CloudFileTypeDetector::detect('contract.pdf', false))->toBe('document')
        ->and(CloudFileTypeDetector::detect('photo.webp', false))->toBe('image')
        ->and(CloudFileTypeDetector::detect('app.tsx', false))->toBe('code')
        ->and(CloudFileTypeDetector::detect('backup.zip', false))->toBe('archive')
        ->and(CloudFileTypeDetector::detect('movie.mp4', false))->toBe('video')
        ->and(CloudFileTypeDetector::detect('song.mp3', false))->toBe('audio')
        ->and(CloudFileTypeDetector::detect('unknown.bin', false))->toBe('other');
});

it('serializes cloud storage data objects to arrays', function () {
    $account = new ConnectedAccountData(
        providerId: 'user-1',
        name: 'OneDrive (user@example.com)',
        credentials: ['access_token' => 'token'],
        totalSpace: 100,
        usedSpace: 25,
    );

    $file = new CloudFileData(
        id: 'folder/file.pdf',
        path: 'folder/file.pdf',
        name: 'file.pdf',
        type: 'document',
        size: 1000,
        updatedAt: 'May 23, 2026',
        isDirectory: false,
    );

    $capabilities = new ProviderCapabilities(
        browse: true,
        upload: true,
        download: true,
        delete: true,
        createFolder: true,
        share: false,
    );

    expect(method_exists($account, 'toArray'))->toBeFalse()
        ->and($account->toConnectionAttributes())->toMatchArray([
            'provider_id' => 'user-1',
            'name' => 'OneDrive (user@example.com)',
            'credentials' => ['access_token' => 'token'],
            'total_space' => 100,
            'used_space' => 25,
        ])->and($file->toArray())->toMatchArray([
            'id' => 'folder/file.pdf',
            'path' => 'folder/file.pdf',
            'name' => 'file.pdf',
            'type' => 'document',
            'size' => 1000,
            'updatedAt' => 'May 23, 2026',
            'isDirectory' => false,
        ])->and($capabilities->toArray())->toMatchArray([
            'browse' => true,
            'upload' => true,
            'download' => true,
            'delete' => true,
            'createFolder' => true,
            'share' => false,
        ]);
});
