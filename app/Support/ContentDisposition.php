<?php

namespace App\Support;

final class ContentDisposition
{
    public static function inline(string $filename): string
    {
        return self::header('inline', $filename);
    }

    public static function attachment(string $filename): string
    {
        return self::header('attachment', $filename);
    }

    private static function header(string $type, string $filename): string
    {
        $safe = str_replace(["\r", "\n", '"', '\\'], '', basename($filename));
        $safe = $safe === '' ? 'download' : $safe;
        $encoded = rawurlencode($safe);

        return $type.'; filename="'.$safe.'"; filename*=UTF-8\'\''.$encoded;
    }
}
