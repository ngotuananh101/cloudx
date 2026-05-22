<?php

namespace App\Models;

use App\Enums\CloudProvider;
use App\Enums\ConnectionStatus;
use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Storage;

class CloudConnection extends Model
{
    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'user_id',
        'name',
        'provider',
        'provider_id',
        'credentials',
        'status',
        'total_space',
        'used_space',
        'error_message',
        'last_synced_at',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'provider' => CloudProvider::class,
            'status' => ConnectionStatus::class,
            'credentials' => 'encrypted:array',
            'total_space' => 'integer',
            'used_space' => 'integer',
            'last_synced_at' => 'datetime',
        ];
    }

    /**
     * Get the user that owns the connection.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Get the dynamically built Flysystem disk for this connection.
     */
    public function getDisk(): Filesystem
    {
        return Storage::build([
            'driver' => 'google_drive',
            'client_id' => config('services.google.client_id'),
            'client_secret' => config('services.google.client_secret'),
            'credentials' => $this->credentials,
            'connection_id' => $this->id,
        ]);
    }
}
