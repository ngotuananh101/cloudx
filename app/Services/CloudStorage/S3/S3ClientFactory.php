<?php

namespace App\Services\CloudStorage\S3;

use App\Models\CloudConnection;
use Aws\Credentials\Credentials;
use Aws\S3\S3Client;

class S3ClientFactory
{
    public function make(CloudConnection $connection): S3Client
    {
        $credentials = $connection->credentials;
        $config = [
            'version' => 'latest',
            'region' => $credentials['region'] ?? 'us-east-1',
            'credentials' => new Credentials(
                $credentials['access_key_id'] ?? '',
                $credentials['secret_access_key'] ?? '',
                $credentials['session_token'] ?? null,
            ),
            'use_path_style_endpoint' => (bool) ($credentials['use_path_style_endpoint'] ?? false),
        ];

        if (! empty($credentials['endpoint'])) {
            $config['endpoint'] = $credentials['endpoint'];
        }

        return new S3Client($config);
    }
}
