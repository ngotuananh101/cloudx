<?php

declare(strict_types=1);

namespace App\Enums;

enum ConnectionStatus: int
{
    case CONNECTED = 1;
    case DISCONNECTED = 2;
    case EXPIRED = 3;
    case ERROR = 4;

    public function getDescription(): string
    {
        return match ($this) {
            self::CONNECTED => 'Connected',
            self::DISCONNECTED => 'Disconnected',
            self::EXPIRED => 'Expired',
            self::ERROR => 'Connection Error',
        };
    }
}
