<?php

declare(strict_types=1);

namespace App\Enums;

use BenSampo\Enum\Enum;

/**
 * @method static static GOOGLE_DRIVE()
 * @method static static ONEDRIVE()
 * @method static static DROPBOX()
 * @method static static AWS_S3()
 * @method static static FTP()
 */
final class CloudProvider extends Enum
{
    const GOOGLE_DRIVE = 1;

    const ONEDRIVE = 2;

    const DROPBOX = 3;

    const AWS_S3 = 4;

    const FTP = 5;

    public static function getDescription(mixed $value): string
    {
        return match ($value) {
            self::GOOGLE_DRIVE => 'Google Drive',
            self::ONEDRIVE => 'OneDrive',
            self::DROPBOX => 'Dropbox',
            self::AWS_S3 => 'AWS S3',
            self::FTP => 'FTP Server',
            default => parent::getDescription($value),
        };
    }
}
