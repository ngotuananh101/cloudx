<?php

namespace App\Jobs;

use App\Enums\ConnectionStatus;
use App\Models\CloudConnection;
use App\Services\CloudStorage\CloudStorageManager;
use App\Services\CloudStorage\Contracts\ReportsStorageQuota;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Throwable;

class UpdateConnectionQuotaJob implements ShouldBeUnique, ShouldQueue
{
    use Queueable;

    public int $tries = 3;

    public int $timeout = 60;

    public int $uniqueFor = 300;

    public function __construct(public int $connectionId) {}

    public function uniqueId(): string
    {
        return (string) $this->connectionId;
    }

    public function handle(CloudStorageManager $manager): void
    {
        $connection = CloudConnection::find($this->connectionId);

        if (! $connection || $connection->status !== ConnectionStatus::CONNECTED) {
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
