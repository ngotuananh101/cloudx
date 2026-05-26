<?php

namespace App\Data;

readonly class CloudStorageQuotaData
{
    public function __construct(
        public ?int $totalBytes,
        public ?int $usedBytes,
        public ?int $remainingBytes,
        public ?float $usedPercent,
        public bool $supported = true,
    ) {}

    /**
     * @return array{totalBytes: int|null, usedBytes: int|null, remainingBytes: int|null, usedPercent: float|null, supported: bool}
     */
    public function toArray(): array
    {
        return [
            'totalBytes' => $this->totalBytes,
            'usedBytes' => $this->usedBytes,
            'remainingBytes' => $this->remainingBytes,
            'usedPercent' => $this->usedPercent,
            'supported' => $this->supported,
        ];
    }

    public static function unsupported(): self
    {
        return new self(
            totalBytes: null,
            usedBytes: null,
            remainingBytes: null,
            usedPercent: null,
            supported: false,
        );
    }
}
