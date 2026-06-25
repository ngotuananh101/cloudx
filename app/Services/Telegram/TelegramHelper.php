<?php

declare(strict_types=1);

namespace App\Services\Telegram;

use Throwable;

class TelegramHelper
{
    /**
     * Resolve the original Telegram filename for a given disk path.
     *
     * Telegram paths are message IDs, not filenames, so download/preview
     * responses built from `basename($path)` expose the message ID to users.
     * This helper extracts the real `original_name` from the adapter's
     * extra metadata so callers can substitute it into the
     * `Content-Disposition` header. Returns `null` for non-Telegram disks
     * or when the name cannot be resolved; callers should fall back to
     * `basename($path)` in that case.
     */
    public static function filenameFor(object $disk, string $path): ?string
    {
        $name = null;

        try {
            $adapter = $disk->getAdapter();
            if ($adapter instanceof TelegramAdapter) {
                $attributes = $adapter->fileSize($path);
                $extra = $attributes->extraMetadata();
                $filename = $extra['file_name'] ?? null;

                if (is_string($filename) && $filename !== '') {
                    $name = $filename;
                }
            }
        } catch (Throwable) {
            // Ignored, name remains null
        }

        return $name;
    }
}
