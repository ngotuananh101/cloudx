<?php

namespace App\Models;

use App\Enums\CloudTaskStatus;
use App\Enums\CloudTaskType;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class CloudTask extends Model
{
    protected $table = 'cloud_task';

    protected $fillable = [
        'user_id',
        'cloud_connection_id',
        'type',
        'status',
        'target_path',
        'name',
        'payload',
        'result',
        'error_message',
        'started_at',
        'queued_at',
        'processing_at',
        'completed_at',
        'failed_at',
        'cancelled_at',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'type' => CloudTaskType::class,
            'status' => CloudTaskStatus::class,
            'payload' => 'array',
            'result' => 'array',
            'started_at' => 'datetime',
            'queued_at' => 'datetime',
            'processing_at' => 'datetime',
            'completed_at' => 'datetime',
            'failed_at' => 'datetime',
            'cancelled_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function connection(): BelongsTo
    {
        return $this->belongsTo(CloudConnection::class, 'cloud_connection_id');
    }

    public function chunks(): HasMany
    {
        return $this->hasMany(CloudTaskChunk::class);
    }
}
