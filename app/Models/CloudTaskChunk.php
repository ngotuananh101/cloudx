<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CloudTaskChunk extends Model
{
    protected $fillable = [
        'cloud_task_id',
        'index',
        'size',
        'checksum',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'index' => 'integer',
            'size' => 'integer',
        ];
    }

    public function task(): BelongsTo
    {
        return $this->belongsTo(CloudTask::class, 'cloud_task_id');
    }
}
