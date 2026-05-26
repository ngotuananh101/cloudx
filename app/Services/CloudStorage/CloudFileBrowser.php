<?php

namespace App\Services\CloudStorage;

use App\Data\CloudFileData;
use App\Models\CloudConnection;
use App\Services\CloudStorage\Contracts\BrowsesCloudFiles;
use League\Flysystem\StorageAttributes;

class CloudFileBrowser
{
    public function __construct(
        private CloudStorageManager $cloudStorage,
        private CloudStorageCache $cache,
    ) {}

    /**
     * @return array<int, array{id: string, path: string, name: string, type: string, size: int|null, updatedAt: string|null, isDirectory: bool}>
     */
    public function list(CloudConnection $connection, string $encodedPath): array
    {
        $decodedPath = $this->decodedPath($encodedPath);
        $files = $this->cache->rememberFolderListing($connection, $decodedPath, function () use ($connection, $decodedPath): array {
            $connector = $this->cloudStorage->connector($connection->provider);

            return $connector instanceof BrowsesCloudFiles
                ? $this->listDirectProvider($connection, $decodedPath, $connector)
                : $this->listFlysystem($connection, $decodedPath);
        });

        usort($files, function (array $first, array $second): int {
            if ($first['isDirectory'] && ! $second['isDirectory']) {
                return -1;
            }

            if (! $first['isDirectory'] && $second['isDirectory']) {
                return 1;
            }

            return strnatcasecmp($first['name'], $second['name']);
        });

        return $files;
    }

    public function decodedPath(string $encodedPath): string
    {
        return PathEncoder::decode($encodedPath);
    }

    /**
     * @return array<int, array{id: string, path: string, name: string, type: string, size: int|null, updatedAt: string|null, isDirectory: bool}>
     */
    private function listDirectProvider(CloudConnection $connection, string $decodedPath, BrowsesCloudFiles $connector): array
    {
        return collect($connector->listContents($connection, $decodedPath))
            ->reject(fn (array $item): bool => str_starts_with((string) $item['name'], '.'))
            ->map(fn (array $item): array => $this->fileData(
                id: (string) $item['id'],
                path: (string) $item['path'],
                name: (string) $item['name'],
                isDirectory: (bool) $item['isDirectory'],
                size: (int) ($item['size'] ?? 0),
                lastModifiedTimestamp: $item['lastModifiedTimestamp'] ?? null,
            )->toArray())
            ->values()
            ->all();
    }

    /**
     * @return array<int, array{id: string, path: string, name: string, type: string, size: int|null, updatedAt: string|null, isDirectory: bool}>
     */
    private function listFlysystem(CloudConnection $connection, string $decodedPath): array
    {
        return collect($this->cloudStorage->disk($connection)->listContents($decodedPath, false))
            ->reject(fn (StorageAttributes $item): bool => str_starts_with(basename($item->path()), '.'))
            ->map(function (StorageAttributes $item): array {
                $isDirectory = $item->isDir();
                $name = basename($item->path());

                return $this->fileData(
                    id: $item->path(),
                    path: $item->path(),
                    name: $name,
                    isDirectory: $isDirectory,
                    size: $isDirectory ? 0 : $item->fileSize(),
                    lastModifiedTimestamp: $item->lastModified(),
                )->toArray();
            })
            ->values()
            ->all();
    }

    private function fileData(string $id, string $path, string $name, bool $isDirectory, ?int $size, ?int $lastModifiedTimestamp): CloudFileData
    {
        return new CloudFileData(
            id: $id,
            path: $path,
            name: $name,
            type: CloudFileTypeDetector::detect($name, $isDirectory),
            size: $isDirectory ? 0 : $size,
            updatedAt: $lastModifiedTimestamp ? date('M j, Y', $lastModifiedTimestamp) : '--',
            isDirectory: $isDirectory,
        );
    }
}
