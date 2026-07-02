<?php

namespace App\Models;

use App\Enums\ActivityAction;
use Database\Factories\ActivityLogFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ActivityLog extends Model
{
    /** @use HasFactory<ActivityLogFactory> */
    use HasFactory;

    const UPDATED_AT = null;

    protected $fillable = [
        'user_id',
        'cloud_connection_id',
        'action',
        'subject_name',
        'source_name',
        'target_name',
        'metadata',
    ];

    protected function casts(): array
    {
        return [
            'action' => ActivityAction::class,
            'metadata' => 'array',
            'created_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function cloudConnection(): BelongsTo
    {
        return $this->belongsTo(CloudConnection::class);
    }

    /**
     * Shape this log entry for use as an Inertia prop.
     *
     * @return array{id: int, action: array{value: int, key: string, label: string, icon: string}, subject_name: string, source_name: string|null, target_name: string|null, connection: array{id: int, name: string}|null, created_at: string|null}
     */
    public function toApiArray(): array
    {
        return [
            'id' => $this->id,
            'action' => [
                'value' => $this->action->value,
                'key' => $this->action->name,
                'label' => $this->action->getDescription(),
                'icon' => $this->action->getIcon(),
            ],
            'subject_name' => $this->subject_name,
            'source_name' => $this->source_name,
            'target_name' => $this->target_name,
            'connection' => $this->cloudConnection ? [
                'id' => $this->cloudConnection->id,
                'name' => $this->cloudConnection->name,
            ] : null,
            'created_at' => $this->created_at?->toJSON(),
        ];
    }
}
