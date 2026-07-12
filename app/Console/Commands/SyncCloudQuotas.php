<?php

namespace App\Console\Commands;

use App\Jobs\UpdateConnectionQuotaJob;
use App\Models\CloudConnection;
use Illuminate\Console\Command;

class SyncCloudQuotas extends Command
{
    protected $signature = 'cloud:sync-quotas';
    protected $description = 'Sync quotas for all active connections';

    public function handle(): void
    {
        CloudConnection::where('status', 1)->chunkById(100, function ($connections) {
            foreach ($connections as $connection) {
                UpdateConnectionQuotaJob::dispatch($connection->id);
            }
        });
    }
}
