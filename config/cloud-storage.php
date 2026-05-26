<?php

return [
    'cache' => [
        'store' => env('CLOUD_STORAGE_CACHE_STORE', 'redis'),
        'ttl' => (int) env('CLOUD_STORAGE_CACHE_TTL', 21600),
    ],

    'uploads' => [
        'chunk_size' => (int) env('CLOUD_UPLOAD_CHUNK_SIZE', 5 * 1024 * 1024),
        'max_file_size' => (int) env('CLOUD_UPLOAD_MAX_FILE_SIZE', 5 * 1024 * 1024 * 1024),
        'temp_disk' => env('CLOUD_UPLOAD_TEMP_DISK', 'local'),
        'temp_path' => env('CLOUD_UPLOAD_TEMP_PATH', 'cloud-task-uploads'),
    ],
];
