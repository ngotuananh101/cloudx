<?php

declare(strict_types=1);

namespace App\Enums;

use BenSampo\Enum\Enum;

/**
 * @method static static Upload()
 */
final class CloudTaskType extends Enum
{
    const Upload = 1;

    public static function getDescription(mixed $value): string
    {
        return match ($value) {
            self::Upload => 'Upload',
            default => parent::getDescription($value),
        };
    }
}
