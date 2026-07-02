<?php

declare(strict_types=1);

namespace App\Enums;

enum ActivityAction: int
{
    case FileUploaded = 1;
    case FileMoved = 2;
    case FileDeleted = 3;
    case FolderCreated = 4;
    case ShareCreated = 5;
    case ShareDeleted = 6;
    case ConnectionCreated = 7;
    case ConnectionDeleted = 8;
    case VideoDownloaded = 9;

    public function getDescription(): string
    {
        return match ($this) {
            self::FileUploaded => 'Uploaded',
            self::FileMoved => 'Moved',
            self::FileDeleted => 'Deleted',
            self::FolderCreated => 'Created folder',
            self::ShareCreated => 'Shared',
            self::ShareDeleted => 'Removed share',
            self::ConnectionCreated => 'Connected',
            self::ConnectionDeleted => 'Disconnected',
            self::VideoDownloaded => 'Downloaded video',
        };
    }

    /**
     * The lucide-react icon key the frontend should render for this action.
     */
    public function getIcon(): string
    {
        return match ($this) {
            self::FileUploaded => 'upload',
            self::FileMoved => 'file-code',
            self::FileDeleted => 'trash',
            self::FolderCreated => 'folder-plus',
            self::ShareCreated => 'file-text',
            self::ShareDeleted => 'file-text',
            self::ConnectionCreated => 'link',
            self::ConnectionDeleted => 'unlink',
            self::VideoDownloaded => 'download',
        };
    }
}
