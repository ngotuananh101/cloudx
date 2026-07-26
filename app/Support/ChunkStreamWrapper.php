<?php

namespace App\Support;

class ChunkStreamWrapper
{
    /** @var resource|null */
    public $context;

    /** @var array<string, array<int, string>> */
    private static array $paths = [];

    private string $id = '';

    private int $currentIndex = 0;

    /** @var resource|null */
    private $currentHandle = null;

    public static function register(string $protocol = 'chunkstream'): void
    {
        if (! in_array($protocol, stream_get_wrappers(), true)) {
            stream_wrapper_register($protocol, self::class);
        }
    }

    /**
     * @param  array<int, string>  $paths
     */
    public static function registerPaths(string $id, array $paths): void
    {
        self::$paths[$id] = $paths;
    }

    public static function unregisterPaths(string $id): void
    {
        unset(self::$paths[$id]);
    }

    public function stream_open(string $path, string $mode, int $options, ?string &$opened_path): bool
    {
        if ($mode !== 'r' && $mode !== 'rb') {
            return false;
        }

        $url = parse_url($path);
        $this->id = $url['host'] ?? '';

        if (! isset(self::$paths[$this->id])) {
            return false;
        }

        $this->currentIndex = 0;
        $this->openCurrentStream();

        return true;
    }

    public function stream_read(int $count): string|false
    {
        if (! $this->currentHandle) {
            return false;
        }

        $data = fread($this->currentHandle, $count);

        if ($data === false) {
            return false;
        }

        while ($this->currentHandle && feof($this->currentHandle)) {
            $this->closeCurrentStream();
            $this->currentIndex++;
            $this->openCurrentStream();
        }

        return $data;
    }

    public function stream_eof(): bool
    {
        return ! $this->currentHandle;
    }

    /**
     * @return array<int|string, int>|false
     */
    public function stream_stat(): array|false
    {
        if (! isset(self::$paths[$this->id])) {
            return false;
        }

        $size = 0;

        foreach (self::$paths[$this->id] as $p) {
            if (file_exists($p)) {
                $size += filesize($p);
            }
        }

        return [
            'size' => $size,
            7 => $size,
        ];
    }

    public function stream_close(): void
    {
        $this->closeCurrentStream();
    }

    private function openCurrentStream(): bool
    {
        if (! isset(self::$paths[$this->id][$this->currentIndex])) {
            return false;
        }

        $this->currentHandle = fopen(self::$paths[$this->id][$this->currentIndex], 'rb');

        return $this->currentHandle !== false;
    }

    private function closeCurrentStream(): void
    {
        if ($this->currentHandle) {
            fclose($this->currentHandle);
            $this->currentHandle = null;
        }
    }
}
