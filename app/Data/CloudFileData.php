<?php

namespace App\Data;

readonly class CloudFileData
{
    public function __construct(
        public string $id,
        public string $path,
        public string $name,
        public string $type,
        public ?int $size,
        public ?string $updatedAt,
        public bool $isDirectory,
    ) {}

    /**
     * @return array{id: string, path: string, name: string, type: string, size: int|null, updatedAt: string|null, isDirectory: bool}
     */
    public function toArray(): array
    {
        return [
            'id' => $this->id,
            'path' => $this->path,
            'name' => $this->name,
            'type' => $this->type,
            'size' => $this->size,
            'updatedAt' => $this->updatedAt,
            'isDirectory' => $this->isDirectory,
        ];
    }
}
