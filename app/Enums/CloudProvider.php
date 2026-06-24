<?php

declare(strict_types=1);

namespace App\Enums;

enum CloudProvider: int
{
    case GOOGLE_DRIVE = 1;
    case ONEDRIVE = 2;
    case DROPBOX = 3;
    case AWS_S3 = 4;
    case FTP = 5;
    case SFTP = 6;
    case TELEGRAM = 7;

    public function slug(): string
    {
        return match ($this) {
            self::GOOGLE_DRIVE => 'google-drive',
            self::ONEDRIVE => 'onedrive',
            self::DROPBOX => 'dropbox',
            self::AWS_S3 => 'aws-s3',
            self::FTP => 'ftp',
            self::SFTP => 'sftp',
            self::TELEGRAM => 'telegram',
        };
    }

    public static function fromSlug(string $slug): ?self
    {
        return match ($slug) {
            'google', 'google-drive' => self::GOOGLE_DRIVE,
            'onedrive' => self::ONEDRIVE,
            'dropbox' => self::DROPBOX,
            'aws-s3' => self::AWS_S3,
            'ftp' => self::FTP,
            'sftp' => self::SFTP,
            'telegram' => self::TELEGRAM,
            default => null,
        };
    }

    public function getDescription(): string
    {
        return match ($this) {
            self::GOOGLE_DRIVE => 'Google Drive',
            self::ONEDRIVE => 'OneDrive',
            self::DROPBOX => 'Dropbox',
            self::AWS_S3 => 'AWS S3',
            self::FTP => 'FTP Server',
            self::SFTP => 'SFTP Server',
            self::TELEGRAM => 'Telegram',
        };
    }

    public static function getIcon(int $value): string
    {
        return match ($value) {
            self::GOOGLE_DRIVE->value => '/assets/svg/GoogleDrive.svg',
            self::ONEDRIVE->value => '/assets/svg/OneDrive.svg',
            self::DROPBOX->value => '/assets/svg/Dropbox.svg',
            self::AWS_S3->value => '/assets/svg/S3.svg',
            self::FTP->value => '/assets/svg/Ftp.svg',
            self::SFTP->value => '/assets/svg/Sftp.svg',
            self::TELEGRAM->value => '/assets/svg/Telegram.svg',
            default => 'cloud',
        };
    }
}
