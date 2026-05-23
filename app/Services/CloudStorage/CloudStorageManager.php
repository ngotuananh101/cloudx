<?php

namespace App\Services\CloudStorage;

use App\Enums\CloudProvider;
use App\Models\CloudConnection;
use App\Services\CloudStorage\Contracts\CloudProviderConnector;
use Illuminate\Contracts\Filesystem\Filesystem;

class CloudStorageManager
{
    public function __construct(private CloudProviderRegistry $registry) {}

    public function connector(CloudProvider $provider): CloudProviderConnector
    {
        return $this->registry->for($provider);
    }

    public function disk(CloudConnection $connection): Filesystem
    {
        return $this->connector($connection->provider)->disk($connection);
    }

    /**
     * @return array<int, CloudProviderConnector>
     */
    public function connectors(): array
    {
        return $this->registry->all();
    }
}
