<?php

declare(strict_types=1);

namespace App\Enums;

enum CloudTaskType: int
{
    case Upload = 1;

    public function getDescription(): string
    {
        return match ($this) {
            self::Upload => 'Upload',
        };
    }
}
