<?php

namespace App\Services\OneDrive;

use League\Flysystem\Config;
use League\Flysystem\DirectoryAttributes;
use League\Flysystem\FileAttributes;
use League\Flysystem\FilesystemAdapter;
use League\Flysystem\StorageAttributes;
use League\Flysystem\UnableToCopyFile;
use League\Flysystem\UnableToCreateDirectory;
use League\Flysystem\UnableToDeleteDirectory;
use League\Flysystem\UnableToDeleteFile;
use League\Flysystem\UnableToMoveFile;
use League\Flysystem\UnableToReadFile;
use League\Flysystem\UnableToRetrieveMetadata;
use League\Flysystem\UnableToSetVisibility;
use League\Flysystem\UnableToWriteFile;
use Throwable;

class OneDriveAdapter implements FilesystemAdapter
{
    public function __construct(private OneDriveClient $client) {}

    public function fileExists(string $path): bool
    {
        $item = $this->client->item($path);

        return is_array($item) && isset($item['file']);
    }

    public function directoryExists(string $path): bool
    {
        $item = $this->client->item($path);

        return is_array($item) && isset($item['folder']);
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
            return $this->client->download($path);
        } catch (Throwable $exception) {
            throw UnableToReadFile::fromLocation($path, $exception->getMessage(), $exception);
        }
    }

    public function readStream(string $path)
    {
        try {
            return $this->client->downloadStream($path);
        } catch (Throwable $exception) {
            throw UnableToReadFile::fromLocation($path, $exception->getMessage(), $exception);
        }
    }

    public function delete(string $path): void
    {
        try {
            $this->client->delete($path);
        } catch (Throwable $exception) {
            throw UnableToDeleteFile::atLocation($path, $exception->getMessage(), $exception);
        }
    }

    public function deleteDirectory(string $path): void
    {
        try {
            $this->client->delete($path);
        } catch (Throwable $exception) {
            throw UnableToDeleteDirectory::atLocation($path, $exception->getMessage(), $exception);
        }
    }

    public function createDirectory(string $path, Config $config): void
    {
        try {
            $this->client->createFolder($path);
        } catch (Throwable $exception) {
            throw UnableToCreateDirectory::atLocation($path, $exception->getMessage(), $exception);
        }
    }

    public function setVisibility(string $path, string $visibility): void
    {
        throw UnableToSetVisibility::atLocation($path, 'OneDrive visibility is not supported.');
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

    public function listContents(string $path, bool $deep): iterable
    {
        foreach ($this->client->listChildren($path) as $item) {
            $attribute = $this->attribute($path, $item);

            yield $attribute;

            if ($deep && $attribute->isDir()) {
                yield from $this->listContents($attribute->path(), true);
            }
        }
    }

    public function move(string $source, string $destination, Config $config): void
    {
        try {
            $this->client->move($source, $destination);
        } catch (Throwable $exception) {
            throw UnableToMoveFile::fromLocationTo($source, $destination, $exception);
        }
    }

    public function copy(string $source, string $destination, Config $config): void
    {
        try {
            $this->client->copy($source, $destination);
        } catch (Throwable $exception) {
            throw UnableToCopyFile::fromLocationTo($source, $destination, $exception);
        }
    }

    /**
     * @param  array<string, mixed>  $item
     */
    private function attribute(string $parent, array $item): StorageAttributes
    {
        $name = (string) ($item['name'] ?? '');
        $path = trim($parent, '/') === '' ? $name : trim($parent, '/').'/'.$name;

        if (array_key_exists('folder', $item)) {
            return new DirectoryAttributes($path, null, $this->timestamp($item));
        }

        return $this->fileAttribute($path, $item);
    }

    private function metadata(string $path): FileAttributes
    {
        $item = $this->client->item($path);

        if (! is_array($item) || ! isset($item['file'])) {
            throw UnableToRetrieveMetadata::create($path);
        }

        return $this->fileAttribute($path, $item);
    }

    /**
     * @param  array<string, mixed>  $item
     */
    private function fileAttribute(string $path, array $item): FileAttributes
    {
        return new FileAttributes(
            path: $path,
            fileSize: (int) ($item['size'] ?? 0),
            visibility: null,
            lastModified: $this->timestamp($item),
            mimeType: isset($item['file']['mimeType']) ? (string) $item['file']['mimeType'] : null,
        );
    }

    /**
     * @param  array<string, mixed>  $item
     */
    private function timestamp(array $item): ?int
    {
        $value = $item['lastModifiedDateTime'] ?? null;

        if (! is_string($value)) {
            return null;
        }

        $timestamp = strtotime($value);

        return $timestamp === false ? null : $timestamp;
    }
}
