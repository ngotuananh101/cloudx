<?php

namespace App\Services\CloudStorage\Contracts;

use App\Models\CloudConnection;

interface BrowsesCloudFiles
{
    /**
     * @return array<int, array{id: string, path: string, name: string, isDirectory: bool, size?: int, lastModifiedTimestamp: int|null}>
     */
    public function listContents(CloudConnection $connection, string $path): array;
}
