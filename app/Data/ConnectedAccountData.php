<?php

namespace App\Data;

readonly class ConnectedAccountData
{
    /**
     * @param  array<string, mixed>  $credentials
     */
    public function __construct(
        public string $providerId,
        public string $name,
        public array $credentials,
        public ?int $totalSpace,
        public ?int $usedSpace,
    ) {}

    /**
     * @return array{provider_id: string, name: string, credentials: array<string, mixed>, total_space: int|null, used_space: int|null}
     */
    public function toConnectionAttributes(): array
    {
        return [
            'provider_id' => $this->providerId,
            'name' => $this->name,
            'credentials' => $this->credentials,
            'total_space' => $this->totalSpace,
            'used_space' => $this->usedSpace,
        ];
    }
}
