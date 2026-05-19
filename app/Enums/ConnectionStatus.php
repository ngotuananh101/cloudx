<?php

declare(strict_types=1);

namespace App\Enums;

use BenSampo\Enum\Enum;

/**
 * @method static static CONNECTED()
 * @method static static DISCONNECTED()
 * @method static static EXPIRED()
 * @method static static ERROR()
 */
final class ConnectionStatus extends Enum
{
    const CONNECTED = 1;

    const DISCONNECTED = 2;

    const EXPIRED = 3;

    const ERROR = 4;

    public static function getDescription(mixed $value): string
    {
        return match ($value) {
            self::CONNECTED => 'Connected',
            self::DISCONNECTED => 'Disconnected',
            self::EXPIRED => 'Expired',
            self::ERROR => 'Connection Error',
            default => parent::getDescription($value),
        };
    }
}
