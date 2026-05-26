<?php

declare(strict_types=1);

namespace App\Enums;

use BenSampo\Enum\Enum;

/**
 * @method static static Pending()
 * @method static static Uploading()
 * @method static static Paused()
 * @method static static Queued()
 * @method static static Processing()
 * @method static static Completed()
 * @method static static Failed()
 * @method static static Cancelled()
 */
final class CloudTaskStatus extends Enum
{
    const Pending = 1;

    const Uploading = 2;

    const Paused = 3;

    const Queued = 4;

    const Processing = 5;

    const Completed = 6;

    const Failed = 7;

    const Cancelled = 8;

    public static function getDescription(mixed $value): string
    {
        return match ($value) {
            self::Pending => 'Pending',
            self::Uploading => 'Uploading',
            self::Paused => 'Paused',
            self::Queued => 'Queued',
            self::Processing => 'Processing',
            self::Completed => 'Completed',
            self::Failed => 'Failed',
            self::Cancelled => 'Cancelled',
            default => parent::getDescription($value),
        };
    }
}
