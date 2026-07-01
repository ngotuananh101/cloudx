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

    'remote_upload' => [
        'max_file_size' => (int) env('CLOUD_REMOTE_UPLOAD_MAX_FILE_SIZE', env('CLOUD_UPLOAD_MAX_FILE_SIZE', 5 * 1024 * 1024 * 1024)),
        'connect_timeout' => (int) env('CLOUD_REMOTE_UPLOAD_CONNECT_TIMEOUT', 10),
        'timeout' => (int) env('CLOUD_REMOTE_UPLOAD_TIMEOUT', 1200),
        'max_redirects' => (int) env('CLOUD_REMOTE_UPLOAD_MAX_REDIRECTS', 3),
        'max_headers' => (int) env('CLOUD_REMOTE_UPLOAD_MAX_HEADERS', 10),
        'max_header_name_length' => (int) env('CLOUD_REMOTE_UPLOAD_MAX_HEADER_NAME_LENGTH', 64),
        'max_header_value_length' => (int) env('CLOUD_REMOTE_UPLOAD_MAX_HEADER_VALUE_LENGTH', 1024),
    ],

    'direct_upload' => [
        'part_ttl_seconds' => (int) env('CLOUD_DIRECT_UPLOAD_PART_TTL_SECONDS', 900),
    ],
];
