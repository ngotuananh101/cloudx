<?php

declare(strict_types=1);

namespace App\Exceptions;

use RuntimeException;

class DownloadJobNotFoundException extends RuntimeException
{
    public function __construct(string $jobId)
    {
        parent::__construct("Download job '{$jobId}' not found or expired.");
    }
}
