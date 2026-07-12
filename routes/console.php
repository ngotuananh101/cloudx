<?php

use App\Console\Commands\PruneActivityLogs;
use App\Console\Commands\SyncCloudQuotas;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Schedule::command(PruneActivityLogs::class)->daily();
Schedule::command(SyncCloudQuotas::class)->hourly();
