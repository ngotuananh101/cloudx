<?php

declare(strict_types=1);

namespace App\Exceptions;

use RuntimeException;

class DownloadFileNotReadyException extends RuntimeException
{
    public function __construct()
    {
        parent::__construct('The requested download file is not ready yet.');
    }
}
