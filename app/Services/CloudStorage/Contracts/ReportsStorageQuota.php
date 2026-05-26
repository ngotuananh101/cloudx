<?php

namespace App\Services\CloudStorage\Contracts;

use App\Data\CloudStorageQuotaData;
use App\Models\CloudConnection;

interface ReportsStorageQuota
{
    public function storageQuota(CloudConnection $connection): CloudStorageQuotaData;
}
