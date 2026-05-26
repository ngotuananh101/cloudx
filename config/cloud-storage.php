<?php

return [
    'cache' => [
        'store' => env('CLOUD_STORAGE_CACHE_STORE', 'redis'),
        'ttl' => (int) env('CLOUD_STORAGE_CACHE_TTL', 21600),
    ],
];
