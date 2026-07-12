<?php

namespace App\Jobs;

use App\Models\CloudConnection;
use App\Services\CloudStorage\CloudStorageManager;
use App\Services\CloudStorage\Contracts\ReportsStorageQuota;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Throwable;

class UpdateConnectionQuotaJob implements ShouldQueue
{
    use Queueable;

    public int $tries = 3;

    public int $timeout = 60;

    public function __construct(public int $connectionId) {}

    public function handle(CloudStorageManager $manager): void
    {
        $connection = CloudConnection::find($this->connectionId);

        if (! $connection || $connection->status->value !== 1) {
            return;
        }

        $connector = $manager->connector($connection->provider);
        if (! $connector instanceof ReportsStorageQuota) {
            return;
        }

        try {
            $quota = $connector->storageQuota($connection);

            if ($quota->supported) {
                $connection->forceFill([
                    'total_space' => $quota->totalBytes,
                    'used_space' => $quota->usedBytes,
                    'last_synced_at' => now(),
                ])->save();
            }
        } catch (Throwable $exception) {
            $connection->handleApiException($exception);
            report($exception);
        }
    }
}
