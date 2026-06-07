<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CloudShare extends Model
{
    protected $fillable = [
        'uuid',
        'user_id',
        'cloud_connection_id',
        'path',
        'name',
        'is_directory',
        'type',
        'password',
        'expires_at',
    ];

    protected $casts = [
        'is_directory' => 'boolean',
        'expires_at' => 'datetime',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function cloudConnection()
    {
        return $this->belongsTo(CloudConnection::class);
    }
}
