<?php

declare(strict_types=1);

namespace App\Enums;

enum CloudTaskStatus: int
{
    case Pending = 1;
    case Uploading = 2;
    case Paused = 3;
    case Queued = 4;
    case Processing = 5;
    case Completed = 6;
    case Failed = 7;
    case Cancelled = 8;

    public function getDescription(): string
    {
        return match ($this) {
            self::Pending => 'Pending',
            self::Uploading => 'Uploading',
            self::Paused => 'Paused',
            self::Queued => 'Queued',
            self::Processing => 'Processing',
            self::Completed => 'Completed',
            self::Failed => 'Failed',
            self::Cancelled => 'Cancelled',
        };
    }
}
