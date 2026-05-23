<?php

namespace App\Services\CloudStorage;

use App\Enums\CloudProvider;
use App\Services\CloudStorage\Contracts\CloudProviderConnector;
use InvalidArgumentException;

class CloudProviderRegistry
{
    /**
     * @var array<int, CloudProviderConnector>
     */
    private array $connectors = [];

    /**
     * @param  iterable<CloudProviderConnector>  $connectors
     */
    public function __construct(iterable $connectors)
    {
        foreach ($connectors as $connector) {
            $this->connectors[$connector->provider()->value] = $connector;
        }
    }

    public function for(CloudProvider $provider): CloudProviderConnector
    {
        return $this->connectors[$provider->value]
            ?? throw new InvalidArgumentException("Unsupported cloud provider [{$provider->value}].");
    }

    /**
     * @return array<int, CloudProviderConnector>
     */
    public function all(): array
    {
        return $this->connectors;
    }
}
