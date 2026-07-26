<?php

namespace App\Services\CloudStorage\S3;

use App\Models\CloudConnection;
use Aws\Credentials\Credentials;
use Aws\S3\S3Client;

class S3ClientFactory
{
    public function __construct(private S3ConnectionConfig $connectionConfig) {}

    public function make(CloudConnection $connection): S3Client
    {
        $options = $this->connectionConfig->clientOptions($connection->credentials);
        $credentialBag = $options['credentials'] ?? [];

        $config = [
            'version' => $options['version'] ?? 'latest',
            'region' => $options['region'] ?? 'us-east-1',
            'credentials' => new Credentials(
                (string) ($credentialBag['key'] ?? ''),
                (string) ($credentialBag['secret'] ?? ''),
                $credentialBag['token'] ?? null,
            ),
            'use_path_style_endpoint' => (bool) ($options['use_path_style_endpoint'] ?? false),
        ];

        if (! empty($options['endpoint'])) {
            $config['endpoint'] = $options['endpoint'];
        }

        return new S3Client($config);
    }
}
