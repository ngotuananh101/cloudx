<?php

use App\Services\OneDrive\OneDriveAdapter;
use App\Services\OneDrive\OneDriveClient;
use League\Flysystem\Config;
use League\Flysystem\DirectoryAttributes;
use League\Flysystem\FileAttributes;
use League\Flysystem\UnableToCopyFile;
use League\Flysystem\UnableToCreateDirectory;
use League\Flysystem\UnableToDeleteDirectory;
use League\Flysystem\UnableToDeleteFile;
use League\Flysystem\UnableToMoveFile;
use League\Flysystem\UnableToReadFile;
use League\Flysystem\UnableToRetrieveMetadata;
use League\Flysystem\UnableToSetVisibility;
use League\Flysystem\UnableToWriteFile;

const CREATED_AT = '2026-01-01T00:00:00Z';
const ONEDRIVE_MIME_TEXT_PLAIN = 'text/plain';
const UPDATED_AT = '2026-01-02T00:00:00Z';
const NESTED_PATH = 'Docs/Nested';
const TEMP_STREAM = 'php://temp';

it('lists files and directories as flysystem attributes', function () {
    $client = Mockery::mock(OneDriveClient::class);
    $client->shouldReceive('listChildren')->with('Docs')->andReturn([
        ['id' => 'folder-id', 'name' => 'Nested', 'folder' => [], 'size' => 0, 'lastModifiedDateTime' => CREATED_AT],
        ['id' => 'file-id', 'name' => 'a.txt', 'file' => ['mimeType' => ONEDRIVE_MIME_TEXT_PLAIN], 'size' => 12, 'lastModifiedDateTime' => UPDATED_AT],
    ]);

    $items = iterator_to_array(new OneDriveAdapter($client)->listContents('Docs', false));

    expect($items)->toHaveCount(2)
        ->and($items[0])->toBeInstanceOf(DirectoryAttributes::class)
        ->and($items[0]->path())->toBe(NESTED_PATH)
        ->and($items[0]->lastModified())->toBe(strtotime(CREATED_AT))
        ->and($items[1])->toBeInstanceOf(FileAttributes::class)
        ->and($items[1]->path())->toBe('Docs/a.txt')
        ->and($items[1]->fileSize())->toBe(12)
        ->and($items[1]->mimeType())->toBe(ONEDRIVE_MIME_TEXT_PLAIN)
        ->and($items[1]->lastModified())->toBe(strtotime(UPDATED_AT));
});

it('recursively lists nested directories when deep listing is requested', function () {
    $client = Mockery::mock(OneDriveClient::class);
    $client->shouldReceive('listChildren')->with('Docs')->andReturn([
        ['name' => 'Nested', 'folder' => [], 'lastModifiedDateTime' => CREATED_AT],
    ]);
    $client->shouldReceive('listChildren')->with(NESTED_PATH)->andReturn([
        ['name' => 'deep.txt', 'file' => ['mimeType' => ONEDRIVE_MIME_TEXT_PLAIN], 'size' => 7, 'lastModifiedDateTime' => '2026-01-03T00:00:00Z'],
    ]);

    $items = iterator_to_array(new OneDriveAdapter($client)->listContents('Docs', true), false);

    expect($items)->toHaveCount(2)
        ->and($items[0])->toBeInstanceOf(DirectoryAttributes::class)
        ->and($items[0]->path())->toBe(NESTED_PATH)
        ->and($items[1])->toBeInstanceOf(FileAttributes::class)
        ->and($items[1]->path())->toBe('Docs/Nested/deep.txt');
});

it('checks file and directory existence by item metadata', function () {
    $client = Mockery::mock(OneDriveClient::class);
    $client->shouldReceive('item')->with('file.txt')->andReturn(['file' => []]);
    $client->shouldReceive('item')->with('Folder')->andReturn(['folder' => []]);
    $client->shouldReceive('item')->with('missing')->andReturn(null);

    $adapter = new OneDriveAdapter($client);

    expect($adapter->fileExists('file.txt'))->toBeTrue()
        ->and($adapter->directoryExists('file.txt'))->toBeFalse()
        ->and($adapter->directoryExists('Folder'))->toBeTrue()
        ->and($adapter->fileExists('Folder'))->toBeFalse()
        ->and($adapter->fileExists('missing'))->toBeFalse();
});

it('returns metadata attributes', function () {
    $client = Mockery::mock(OneDriveClient::class);
    $client->shouldReceive('item')->with('file.txt')->andReturn([
        'name' => 'file.txt',
        'file' => ['mimeType' => ONEDRIVE_MIME_TEXT_PLAIN],
        'size' => 12,
        'lastModifiedDateTime' => UPDATED_AT,
    ]);

    $adapter = new OneDriveAdapter($client);

    expect($adapter->fileSize('file.txt')->fileSize())->toBe(12)
        ->and($adapter->mimeType('file.txt')->mimeType())->toBe(ONEDRIVE_MIME_TEXT_PLAIN)
        ->and($adapter->lastModified('file.txt')->lastModified())->toBe(strtotime(UPDATED_AT));
});

it('rejects unsupported visibility operations', function () {
    $adapter = new OneDriveAdapter(Mockery::mock(OneDriveClient::class));

    expect(fn () => $adapter->visibility('file.txt'))->toThrow(UnableToRetrieveMetadata::class)
        ->and(fn () => $adapter->setVisibility('file.txt', 'public'))->toThrow(UnableToSetVisibility::class);
});

it('delegates read and write operations to client', function () {
    $client = Mockery::mock(OneDriveClient::class);
    $client->shouldReceive('download')->with('a.txt')->once()->andReturn('body');
    $client->shouldReceive('downloadStream')->with('a.txt')->once()->andReturn(fopen(TEMP_STREAM, 'r+'));
    $client->shouldReceive('upload')->with('a.txt', 'new')->once();
    $client->shouldReceive('uploadStream')->once();

    $adapter = new OneDriveAdapter($client);
    $stream = fopen(TEMP_STREAM, 'r+');

    expect($adapter->read('a.txt'))->toBe('body')
        ->and(is_resource($adapter->readStream('a.txt')))->toBeTrue();

    $adapter->write('a.txt', 'new', new Config);
    $adapter->writeStream('a.txt', $stream, new Config);
});

it('delegates delete folder move and copy operations to client', function () {
    $client = Mockery::mock(OneDriveClient::class);
    $client->shouldReceive('delete')->with('a.txt')->once();
    $client->shouldReceive('delete')->with('Folder')->once();
    $client->shouldReceive('createFolder')->with('New')->once();
    $client->shouldReceive('move')->with('a.txt', 'b.txt')->once();
    $client->shouldReceive('copy')->with('b.txt', 'c.txt')->once();

    $adapter = new OneDriveAdapter($client);
    $adapter->delete('a.txt');
    $adapter->deleteDirectory('Folder');
    $adapter->createDirectory('New', new Config);
    $adapter->move('a.txt', 'b.txt', new Config);
    $adapter->copy('b.txt', 'c.txt', new Config);

    expect(true)->toBeTrue();
});

it('maps client failures to flysystem operation exceptions', function (string $method, array $arguments, string $clientMethod, array $clientArguments, string $exceptionClass) {
    $client = Mockery::mock(OneDriveClient::class);
    $client->shouldReceive($clientMethod)->with(...$clientArguments)->once()->andThrow(new RuntimeException('Graph failed.'));

    expect(fn () => new OneDriveAdapter($client)->{$method}(...$arguments))->toThrow($exceptionClass);
})->with([
    ['write', ['a.txt', 'new', new Config], 'upload', ['a.txt', 'new'], UnableToWriteFile::class],
    ['writeStream', ['a.txt', fopen(TEMP_STREAM, 'r+'), new Config], 'uploadStream', ['a.txt', Mockery::type('resource')], UnableToWriteFile::class],
    ['read', ['a.txt'], 'download', ['a.txt'], UnableToReadFile::class],
    ['readStream', ['a.txt'], 'downloadStream', ['a.txt'], UnableToReadFile::class],
    ['delete', ['a.txt'], 'delete', ['a.txt'], UnableToDeleteFile::class],
    ['deleteDirectory', ['Folder'], 'delete', ['Folder'], UnableToDeleteDirectory::class],
    ['createDirectory', ['Folder', new Config], 'createFolder', ['Folder'], UnableToCreateDirectory::class],
    ['move', ['a.txt', 'b.txt', new Config], 'move', ['a.txt', 'b.txt'], UnableToMoveFile::class],
    ['copy', ['a.txt', 'b.txt', new Config], 'copy', ['a.txt', 'b.txt'], UnableToCopyFile::class],
]);
