<?php

namespace App\Services\CloudStorage;

use App\Data\CloudStorageQuotaData;
use App\Jobs\UpdateConnectionQuotaJob;
use App\Models\CloudConnection;
use Illuminate\Support\Facades\Cache;

class CloudStorageQuota
{
    public function get(CloudConnection $connection): array
    {
        return $this->storedQuota($connection)->toArray();
    }

    public function refreshInBackground(CloudConnection $connection): void
    {
        $lockKey = 'quota_update_lock_' . $connection->id;

        if (! Cache::has($lockKey)) {
            Cache::put($lockKey, true, 600);
            dispatch(new UpdateConnectionQuotaJob($connection->id));
        }
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
}
