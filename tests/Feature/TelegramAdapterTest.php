<?php

use App\Services\Telegram\TelegramAdapter;
use App\Services\Telegram\TelegramClient;
use App\Services\Telegram\TelegramHelper;
use League\Flysystem\Config;
use League\Flysystem\FileAttributes;
use League\Flysystem\UnableToCopyFile;
use League\Flysystem\UnableToDeleteFile;
use League\Flysystem\UnableToMoveFile;
use League\Flysystem\UnableToReadFile;
use League\Flysystem\UnableToRetrieveMetadata;
use League\Flysystem\UnableToSetVisibility;
use League\Flysystem\UnableToWriteFile;

const TELEGRAM_MESSAGE_ID = 12345;
const TELEGRAM_MESSAGE_ID_STR = '12345';
const TELEGRAM_MIME_PLAIN = 'text/plain';
const TELEGRAM_TIMESTAMP = '2026-01-01T00:00:00';
const TELEGRAM_FILENAME = 'test.txt';
const TELEGRAM_PHP_TEMP = 'php://temp';

it('delegates write to client upload', function () {
    $client = Mockery::mock(TelegramClient::class);
    $client->shouldReceive('upload')->with(TELEGRAM_FILENAME, 'hello')->once()->andReturn(TELEGRAM_MESSAGE_ID);

    $adapter = new TelegramAdapter($client);
    $adapter->write(TELEGRAM_FILENAME, 'hello', new Config);

    expect(true)->toBeTrue();
});

it('delegates writeStream to client uploadStream', function () {
    $stream = fopen(TELEGRAM_PHP_TEMP, 'r+');
    fwrite($stream, 'data');

    $client = Mockery::mock(TelegramClient::class);
    $client->shouldReceive('uploadStream')->with(TELEGRAM_FILENAME, Mockery::type('resource'))->once()->andReturn(TELEGRAM_MESSAGE_ID);

    $adapter = new TelegramAdapter($client);
    $adapter->writeStream(TELEGRAM_FILENAME, $stream, new Config);

    expect(true)->toBeTrue();
});

it('delegates read to client download', function () {
    $client = Mockery::mock(TelegramClient::class);
    $client->shouldReceive('download')->with(TELEGRAM_MESSAGE_ID)->once()->andReturn('file contents');

    $adapter = new TelegramAdapter($client);

    expect($adapter->read(TELEGRAM_MESSAGE_ID_STR))->toBe('file contents');
});

it('delegates readStream to client downloadStream', function () {
    $client = Mockery::mock(TelegramClient::class);
    $client->shouldReceive('downloadStream')->with(TELEGRAM_MESSAGE_ID)->once()->andReturn(fopen(TELEGRAM_PHP_TEMP, 'r+'));

    $adapter = new TelegramAdapter($client);
    $stream = $adapter->readStream(TELEGRAM_MESSAGE_ID_STR);

    expect(is_resource($stream))->toBeTrue();
});

it('delegates delete to client', function () {
    $client = Mockery::mock(TelegramClient::class);
    $client->shouldReceive('delete')->with(TELEGRAM_MESSAGE_ID)->once();

    $adapter = new TelegramAdapter($client);
    $adapter->delete(TELEGRAM_MESSAGE_ID_STR);

    expect(true)->toBeTrue();
});

it('checks file existence via metadata', function () {
    $client = Mockery::mock(TelegramClient::class);
    $client->shouldReceive('metadata')->with(TELEGRAM_MESSAGE_ID)->once()->andReturn(['message_id' => TELEGRAM_MESSAGE_ID]);
    $client->shouldReceive('metadata')->with(99999)->once()->andReturn(null);

    $adapter = new TelegramAdapter($client);

    expect($adapter->fileExists(TELEGRAM_MESSAGE_ID_STR))->toBeTrue()
        ->and($adapter->fileExists('99999'))->toBeFalse();
});

it('always returns false for directoryExists', function () {
    $client = Mockery::mock(TelegramClient::class);

    $adapter = new TelegramAdapter($client);

    expect($adapter->directoryExists('anything'))->toBeFalse();
});

it('returns FileAttributes from metadata methods', function () {
    $client = Mockery::mock(TelegramClient::class);
    $client->shouldReceive('metadata')->with(TELEGRAM_MESSAGE_ID)->andReturn([
        'message_id' => TELEGRAM_MESSAGE_ID,
        'original_name' => TELEGRAM_FILENAME,
        'size' => 100,
        'mime_type' => TELEGRAM_MIME_PLAIN,
        'caption' => TELEGRAM_FILENAME,
        'created_at' => TELEGRAM_TIMESTAMP,
        'updated_at' => TELEGRAM_TIMESTAMP,
    ]);

    $adapter = new TelegramAdapter($client);

    $fileSize = $adapter->fileSize(TELEGRAM_MESSAGE_ID_STR);
    expect($fileSize)->toBeInstanceOf(FileAttributes::class)
        ->and($fileSize->fileSize())->toBe(100);

    $mimeType = $adapter->mimeType(TELEGRAM_MESSAGE_ID_STR);
    expect($mimeType)->toBeInstanceOf(FileAttributes::class)
        ->and($mimeType->mimeType())->toBe(TELEGRAM_MIME_PLAIN);

    $lastModified = $adapter->lastModified(TELEGRAM_MESSAGE_ID_STR);
    expect($lastModified)->toBeInstanceOf(FileAttributes::class)
        ->and($lastModified->lastModified())->toBe(strtotime(TELEGRAM_TIMESTAMP));
});

it('lists contents as FileAttributes with message_id as path', function () {
    $client = Mockery::mock(TelegramClient::class);
    $client->shouldReceive('listAll')->with(100, 0)->andReturn([
        'total' => 2,
        'limit' => 100,
        'offset' => 0,
        'files' => [
            ['message_id' => 1, 'original_name' => 'a.txt', 'size' => 10, 'mime_type' => TELEGRAM_MIME_PLAIN, 'created_at' => TELEGRAM_TIMESTAMP],
            ['message_id' => 2, 'original_name' => 'b.jpg', 'size' => 200, 'mime_type' => 'image/jpeg', 'created_at' => '2026-01-02T00:00:00'],
        ],
    ]);

    $adapter = new TelegramAdapter($client);
    $items = iterator_to_array($adapter->listContents('', false));

    expect($items)->toHaveCount(2)
        ->and($items[0])->toBeInstanceOf(FileAttributes::class)
        ->and($items[0]->path())->toBe('1')
        ->and($items[0]->fileSize())->toBe(10)
        ->and($items[0]->mimeType())->toBe(TELEGRAM_MIME_PLAIN)
        ->and($items[1]->path())->toBe('2')
        ->and($items[1]->fileSize())->toBe(200);
});

it('paginates listContents across multiple pages', function () {
    $client = Mockery::mock(TelegramClient::class);
    $client->shouldReceive('listAll')->with(2, 0)->andReturn([
        'total' => 3,
        'limit' => 2,
        'offset' => 0,
        'files' => [
            ['message_id' => 1, 'original_name' => 'a.txt', 'size' => 10, 'mime_type' => TELEGRAM_MIME_PLAIN, 'created_at' => TELEGRAM_TIMESTAMP],
            ['message_id' => 2, 'original_name' => 'b.txt', 'size' => 20, 'mime_type' => TELEGRAM_MIME_PLAIN, 'created_at' => '2026-01-02T00:00:00'],
        ],
    ]);
    $client->shouldReceive('listAll')->with(2, 2)->andReturn([
        'total' => 3,
        'limit' => 2,
        'offset' => 2,
        'files' => [
            ['message_id' => 3, 'original_name' => 'c.txt', 'size' => 30, 'mime_type' => TELEGRAM_MIME_PLAIN, 'created_at' => '2026-01-03T00:00:00'],
        ],
    ]);

    // Override adapter to use page size 2
    $adapter = new class($client) extends TelegramAdapter
    {
        public function listContents(string $path, bool $deep): iterable
        {
            $offset = 0;
            $limit = 2;
            $result = [];
            $files = [];

            do {
                $result = $this->client->listAll($limit, $offset);
                $files = $result['files'] ?? [];

                foreach ($files as $file) {
                    yield $this->fileAttribute($file);
                }

                $offset += $limit;
            } while ($offset < ($result['total'] ?? 0));
        }
    };

    $items = iterator_to_array($adapter->listContents('', false));

    expect($items)->toHaveCount(3)
        ->and($items[0]->path())->toBe('1')
        ->and($items[2]->path())->toBe('3');
});

it('rejects visibility operations', function () {
    $adapter = new TelegramAdapter(Mockery::mock(TelegramClient::class));

    expect(fn () => $adapter->visibility(TELEGRAM_MESSAGE_ID_STR))->toThrow(UnableToRetrieveMetadata::class)
        ->and(fn () => $adapter->setVisibility(TELEGRAM_MESSAGE_ID_STR, 'public'))->toThrow(UnableToSetVisibility::class);
});

it('rejects move and copy', function () {
    $adapter = new TelegramAdapter(Mockery::mock(TelegramClient::class));

    expect(fn () => $adapter->move('1', '2', new Config))->toThrow(UnableToMoveFile::class)
        ->and(fn () => $adapter->copy('1', '2', new Config))->toThrow(UnableToCopyFile::class);
});

it('no-ops createDirectory and deleteDirectory', function () {
    $adapter = new TelegramAdapter(Mockery::mock(TelegramClient::class));

    $adapter->createDirectory('folder', new Config);
    $adapter->deleteDirectory('folder');

    expect(true)->toBeTrue();
});

it('maps client failures to flysystem exceptions', function (string $method, array $arguments, string $clientMethod, array $clientArgs, string $exceptionClass) {
    $client = Mockery::mock(TelegramClient::class);
    $client->shouldReceive($clientMethod)->with(...$clientArgs)->once()->andThrow(new RuntimeException('API failed.'));

    expect(fn () => new TelegramAdapter($client)->{$method}(...$arguments))->toThrow($exceptionClass);
})->with([
    'write' => ['write', ['a.txt', 'new', new Config], 'upload', ['a.txt', 'new'], UnableToWriteFile::class],
    'writeStream' => ['writeStream', ['a.txt', fopen(TELEGRAM_PHP_TEMP, 'r+'), new Config], 'uploadStream', ['a.txt', Mockery::type('resource')], UnableToWriteFile::class],
    ['read', [TELEGRAM_MESSAGE_ID_STR], 'download', [TELEGRAM_MESSAGE_ID], UnableToReadFile::class],
    ['readStream', [TELEGRAM_MESSAGE_ID_STR], 'downloadStream', [TELEGRAM_MESSAGE_ID], UnableToReadFile::class],
    ['delete', [TELEGRAM_MESSAGE_ID_STR], 'delete', [TELEGRAM_MESSAGE_ID], UnableToDeleteFile::class],
]);

it('returns the original file_name via filenameFor when the disk wraps a TelegramAdapter', function () {
    $client = Mockery::mock(TelegramClient::class);
    $client->shouldReceive('metadata')->with(TELEGRAM_MESSAGE_ID)->andReturn([
        'message_id' => TELEGRAM_MESSAGE_ID,
        'original_name' => 'photo.png',
    ]);

    $adapter = new TelegramAdapter($client);

    $disk = Mockery::mock();
    $disk->shouldReceive('getAdapter')->andReturn($adapter);

    expect(TelegramHelper::filenameFor($disk, TELEGRAM_MESSAGE_ID_STR))->toBe('photo.png');
});

it('returns null via filenameFor when the disk does not wrap a TelegramAdapter', function () {
    $disk = Mockery::mock();
    $disk->shouldReceive('getAdapter')->andReturn(new class {});

    expect(TelegramHelper::filenameFor($disk, 'whatever.txt'))->toBeNull();
});

it('returns null via filenameFor when the file_name extra metadata is missing', function () {
    $client = Mockery::mock(TelegramClient::class);
    $client->shouldReceive('metadata')->with(TELEGRAM_MESSAGE_ID)->andReturn([
        'message_id' => TELEGRAM_MESSAGE_ID,
    ]);

    $adapter = new TelegramAdapter($client);

    $disk = Mockery::mock();
    $disk->shouldReceive('getAdapter')->andReturn($adapter);

    expect(TelegramHelper::filenameFor($disk, TELEGRAM_MESSAGE_ID_STR))->toBeNull();
});

it('returns null via filenameFor when the adapter throws while resolving the file name', function () {
    $client = Mockery::mock(TelegramClient::class);
    $client->shouldReceive('metadata')->with(TELEGRAM_MESSAGE_ID)->andThrow(new RuntimeException('boom'));

    $adapter = new TelegramAdapter($client);

    $disk = Mockery::mock();
    $disk->shouldReceive('getAdapter')->andReturn($adapter);

    expect(TelegramHelper::filenameFor($disk, TELEGRAM_MESSAGE_ID_STR))->toBeNull();
});
