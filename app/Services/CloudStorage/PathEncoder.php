<?php

namespace App\Services\CloudStorage;

class PathEncoder
{
    public static function encode(string $path): string
    {
        return rtrim(strtr(base64_encode($path), '+/', '-_'), '=');
    }

    public static function decode(?string $encoded): string
    {
        if (blank($encoded) || preg_match('/[^A-Za-z0-9_-]/', $encoded) === 1) {
            return '';
        }

        $decoded = base64_decode(strtr($encoded, '-_', '+/'), true);

        return $decoded === false ? '' : $decoded;
    }
}
