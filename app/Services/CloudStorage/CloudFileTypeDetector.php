<?php

namespace App\Services\CloudStorage;

use Illuminate\Support\Str;

class CloudFileTypeDetector
{
    /**
     * @var array<string, list<string>>
     */
    private const EXTENSIONS = [
        'document' => ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'rtf', 'odt', 'ods', 'odp'],
        'image' => ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico', 'tiff'],
        'code' => ['php', 'js', 'jsx', 'ts', 'tsx', 'css', 'scss', 'html', 'json', 'xml', 'yaml', 'yml', 'md', 'py', 'rb', 'go', 'rs', 'java', 'c', 'cpp', 'cs'],
        'archive' => ['zip', 'rar', '7z', 'tar', 'gz', 'bz2'],
        'video' => ['mp4', 'mov', 'avi', 'mkv', 'webm', 'wmv'],
        'audio' => ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a'],
    ];

    public static function detect(string $name, bool $isDirectory): string
    {
        if ($isDirectory) {
            return 'folder';
        }

        $extension = Str::of($name)->afterLast('.')->lower()->toString();

        foreach (self::EXTENSIONS as $type => $extensions) {
            if (in_array($extension, $extensions, true)) {
                return $type;
            }
        }

        return 'other';
    }
}
