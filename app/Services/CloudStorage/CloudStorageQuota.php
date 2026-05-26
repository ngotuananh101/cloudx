<?php

namespace App\Services\CloudStorage;

use App\Data\CloudStorageQuotaData;
use App\Models\CloudConnection;
use App\Services\CloudStorage\Contracts\ReportsStorageQuota;
use Throwable;

class CloudStorageQuota
{
    public function __construct(
        private CloudStorageManager $cloudStorage,
        private CloudStorageCache $cache,
    ) {}

    /**
     * @return array{totalBytes: int|null, usedBytes: int|null, remainingBytes: int|null, usedPercent: float|null, supported: bool}
     */
    public function get(CloudConnection $connection): array
    {
        return $this->cache->rememberQuota($connection, function () use ($connection): array {
            $connector = $this->cloudStorage->connector($connection->provider);

            if ($connector instanceof ReportsStorageQuota) {
                try {
                    $quota = $connector->storageQuota($connection);
                    $this->syncConnectionQuota($connection, $quota);

                    return $quota->toArray();
                } catch (Throwable $exception) {
                    report($exception);
                }
            }

            return $this->storedQuota($connection)->toArray();
        });
    }

    private function storedQuota(CloudConnection $connection): CloudStorageQuotaData
    {
        if ($connection->total_space === null && $connection->used_space === null) {
            return CloudStorageQuotaData::unsupported();
        }

        $totalBytes = $connection->total_space;
        $usedBytes = $connection->used_space;
        $remainingBytes = $totalBytes !== null && $usedBytes !== null ? max($totalBytes - $usedBytes, 0) : null;

        return new CloudStorageQuotaData(
            totalBytes: $totalBytes,
            usedBytes: $usedBytes,
            remainingBytes: $remainingBytes,
            usedPercent: $totalBytes > 0 && $usedBytes !== null ? round(($usedBytes / $totalBytes) * 100, 1) : null,
        );
    }

    private function syncConnectionQuota(CloudConnection $connection, CloudStorageQuotaData $quota): void
    {
        if (! $quota->supported) {
            return;
        }

        $connection->forceFill([
            'total_space' => $quota->totalBytes,
            'used_space' => $quota->usedBytes,
            'last_synced_at' => now(),
        ])->save();
    }
}
