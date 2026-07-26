<?php

use App\Services\CloudStorage\S3\S3ConnectionConfig;

it('applies wasabi default endpoint for client and disk configs', function () {
    $config = app(S3ConnectionConfig::class);
    $creds = [
        'provider_preset' => 'wasabi',
        'access_key_id' => 'access-key',
        'secret_access_key' => 'secret-key',
        'region' => 'us-east-1',
        'bucket' => 'cloudx-bucket',
    ];

    expect($config->clientOptions($creds)['endpoint'])->toBe('https://s3.wasabisys.com')
        ->and($config->diskOptions($creds)['endpoint'])->toBe('https://s3.wasabisys.com')
        ->and($config->diskOptions($creds)['throw'])->toBeTrue()
        ->and($config->diskOptions($creds)['report'])->toBeTrue()
        ->and($config->objectKey(['root' => 'uploads'], 'a/b.pdf'))->toBe('uploads/a/b.pdf');
});

it('prefixes object keys with root and leaves empty root untouched', function () {
    $config = app(S3ConnectionConfig::class);

    expect($config->objectKey(['root' => ''], 'docs/a.pdf'))->toBe('docs/a.pdf')
        ->and($config->objectKey(['root' => '/media/'], '/photos/1.jpg'))->toBe('media/photos/1.jpg');
});
