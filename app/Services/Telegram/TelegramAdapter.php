<?php

declare(strict_types=1);

namespace App\Services\Telegram;

use League\Flysystem\Config;
use League\Flysystem\FileAttributes;
use League\Flysystem\FilesystemAdapter;
use League\Flysystem\StorageAttributes;
use League\Flysystem\UnableToCopyFile;
use League\Flysystem\UnableToDeleteFile;
use League\Flysystem\UnableToMoveFile;
use League\Flysystem\UnableToReadFile;
use League\Flysystem\UnableToRetrieveMetadata;
use League\Flysystem\UnableToSetVisibility;
use League\Flysystem\UnableToWriteFile;
use RuntimeException;
use Throwable;

class TelegramAdapter implements FilesystemAdapter
{
    public function __construct(
        /** @var TelegramClient */
        protected readonly TelegramClient $client,
    ) {}

    public function fileExists(string $path): bool
    {
        return $this->client->metadata((int) $path) !== null;
    }

    public function directoryExists(string $path): bool
    {
        return false;
    }

    public function write(string $path, string $contents, Config $config): void
    {
        try {
            $this->client->upload($path, $contents);
        } catch (Throwable $exception) {
            throw UnableToWriteFile::atLocation($path, $exception->getMessage(), $exception);
        }
    }

    public function writeStream(string $path, $contents, Config $config): void
    {
        try {
            $this->client->uploadStream($path, $contents);
        } catch (Throwable $exception) {
            throw UnableToWriteFile::atLocation($path, $exception->getMessage(), $exception);
        }
    }

    public function read(string $path): string
    {
        try {
            return $this->client->download((int) $path);
        } catch (Throwable $exception) {
            throw UnableToReadFile::fromLocation($path, $exception->getMessage(), $exception);
        }
    }

    public function readStream(string $path)
    {
        try {
            return $this->client->downloadStream((int) $path);
        } catch (Throwable $exception) {
            throw UnableToReadFile::fromLocation($path, $exception->getMessage(), $exception);
        }
    }

    public function delete(string $path): void
    {
        try {
            $this->client->delete((int) $path);
        } catch (Throwable $exception) {
            throw UnableToDeleteFile::atLocation($path, $exception->getMessage(), $exception);
        }
    }

    public function deleteDirectory(string $path): void
    {
        // Telegram has no folder concept — no-op.
    }

    public function createDirectory(string $path, Config $config): void
    {
        // Telegram has no folder concept — no-op.
    }

    public function setVisibility(string $path, string $visibility): void
    {
        throw UnableToSetVisibility::atLocation($path, 'Telegram visibility is not supported.');
    }

    public function visibility(string $path): FileAttributes
    {
        throw UnableToRetrieveMetadata::visibility($path);
    }

    public function mimeType(string $path): FileAttributes
    {
        return $this->metadata($path);
    }

    public function lastModified(string $path): FileAttributes
    {
        return $this->metadata($path);
    }

    public function fileSize(string $path): FileAttributes
    {
        return $this->metadata($path);
    }

    /**
     * @return iterable<StorageAttributes>
     */
    public function listContents(string $path, bool $deep): iterable
    {
        $offset = 0;
        $limit = 100;

        do {
            $result = $this->client->listAll($limit, $offset);
            $files = $result['files'] ?? [];

            foreach ($files as $file) {
                yield $this->fileAttribute($file);
            }

            $offset += $limit;
        } while ($offset < ($result['total'] ?? 0));
    }

    public function move(string $source, string $destination, Config $config): void
    {
        throw UnableToMoveFile::fromLocationTo($source, $destination, new RuntimeException('Telegram does not support move.'));
    }

    public function copy(string $source, string $destination, Config $config): void
    {
        throw UnableToCopyFile::fromLocationTo($source, $destination, new RuntimeException('Telegram does not support copy.'));
    }

    /**
     * @param  array<string, mixed>  $meta
     */
    private function metadata(string $path): FileAttributes
    {
        $meta = $this->client->metadata((int) $path);

        if (! is_array($meta)) {
            throw UnableToRetrieveMetadata::create($path);
        }

        return $this->fileAttribute($meta);
    }

    /**
     * @param  array<string, mixed>  $file
     */
    protected function fileAttribute(array $file): FileAttributes
    {
        $createdAt = $file['created_at'] ?? null;

        return new FileAttributes(
            path: (string) ($file['message_id'] ?? ''),
            fileSize: isset($file['size']) ? (int) $file['size'] : null,
            visibility: null,
            lastModified: is_string($createdAt) ? strtotime($createdAt) : null,
            mimeType: isset($file['mime_type']) ? (string) $file['mime_type'] : null,
            extraMetadata: [
                'file_name' => $file['file_name'] ?? null,
            ],
        );
    }
}
