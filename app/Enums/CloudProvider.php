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

    public function slug(): string
    {
        return match ($this->value) {
            self::GOOGLE_DRIVE => 'google-drive',
            self::ONEDRIVE => 'onedrive',
            self::DROPBOX => 'dropbox',
            self::AWS_S3 => 'aws-s3',
            self::FTP => 'ftp',
        };
    }

    public static function fromSlug(string $slug): ?self
    {
        return match ($slug) {
            'google', 'google-drive' => self::GOOGLE_DRIVE(),
            'onedrive' => self::ONEDRIVE(),
            'dropbox' => self::DROPBOX(),
            'aws-s3' => self::AWS_S3(),
            'ftp' => self::FTP(),
            default => null,
        };
    }

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

    public static function getIcon(int $value): string
    {
        return match ($value) {
            self::GOOGLE_DRIVE => '/assets/svg/GoogleDrive.svg',
            self::ONEDRIVE => '/assets/svg/OneDrive.svg',
            self::DROPBOX => '/assets/svg/Dropbox.svg',
            self::AWS_S3 => '/assets/svg/S3.svg',
            self::FTP => '/assets/svg/Ftp.svg',
            default => 'cloud',
        };
    }
}
