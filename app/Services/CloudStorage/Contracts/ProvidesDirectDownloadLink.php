<?php

namespace App\Services\CloudStorage\Contracts;

use App\Models\CloudConnection;

interface ProvidesDirectDownloadLink
{
    public function directDownloadLink(CloudConnection $connection, string $path): ?string;
}
