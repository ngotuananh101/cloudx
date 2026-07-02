<?php

namespace App\Console\Commands;

use App\Models\ActivityLog;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

#[Signature('app:prune-activity-logs')]
#[Description('Delete activity log entries older than 90 days')]
class PruneActivityLogs extends Command
{
    /**
     * The number of days of activity logs to retain.
     */
    private const RETENTION_DAYS = 90;

    /**
     * Execute the console command.
     */
    public function handle(): void
    {
        $deleted = 0;

        ActivityLog::query()
            ->where('created_at', '<', now()->subDays(self::RETENTION_DAYS))
            ->chunkById(500, function ($logs) use (&$deleted): void {
                $deleted += $logs->count();
                ActivityLog::query()->whereKey($logs->pluck('id'))->delete();
            });

        $this->info("Deleted {$deleted} activity log entries older than ".self::RETENTION_DAYS.' days.');
    }
}
