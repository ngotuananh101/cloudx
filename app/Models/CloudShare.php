<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Hidden(['password'])]
class CloudShare extends Model
{
    protected $fillable = [
        'uuid',
        'user_id',
        'cloud_connection_id',
        'path',
        'name',
        'extra_info',
        'is_directory',
        'type',
        'password',
        'expires_at',
    ];

    protected $casts = [
        'is_directory' => 'boolean',
        'expires_at' => 'datetime',
        'extra_info' => 'array',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function cloudConnection(): BelongsTo
    {
        return $this->belongsTo(CloudConnection::class);
    }
}
