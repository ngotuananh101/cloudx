<?php

namespace App\Models;

use App\Enums\CloudProvider;
use App\Enums\ConnectionStatus;
use App\Services\CloudStorage\CloudStorageManager;
use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

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

    public function tasks(): HasMany
    {
        return $this->hasMany(CloudTask::class);
    }

    public function canReconnect(): bool
    {
        return in_array($this->provider->value, [
            CloudProvider::GOOGLE_DRIVE,
            CloudProvider::ONEDRIVE,
        ], true);
    }

    public function canEditName(): bool
    {
        return $this->canReconnect();
    }

    public function canEditConnection(): bool
    {
        return false;
    }

    public function canDelete(): bool
    {
        return true;
    }

    /**
     * @return array{canReconnect: bool, canEditName: bool, canEditConnection: bool, canDelete: bool}
     */
    public function actions(): array
    {
        return [
            'canReconnect' => $this->canReconnect(),
            'canEditName' => $this->canEditName(),
            'canEditConnection' => $this->canEditConnection(),
            'canDelete' => $this->canDelete(),
        ];
    }

    /**
     * Get the dynamically built Flysystem disk for this connection.
     */
    public function getDisk(): Filesystem
    {
        return app(CloudStorageManager::class)->disk($this);
    }
}
