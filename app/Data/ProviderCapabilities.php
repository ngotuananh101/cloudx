<?php

namespace App\Data;

readonly class ProviderCapabilities
{
    public function __construct(
        public bool $browse,
        public bool $upload,
        public bool $download,
        public bool $delete,
        public bool $createFolder,
        public bool $share,
    ) {}

    /**
     * @return array{browse: bool, upload: bool, download: bool, delete: bool, createFolder: bool, share: bool}
     */
    public function toArray(): array
    {
        return [
            'browse' => $this->browse,
            'upload' => $this->upload,
            'download' => $this->download,
            'delete' => $this->delete,
            'createFolder' => $this->createFolder,
            'share' => $this->share,
        ];
    }
}
