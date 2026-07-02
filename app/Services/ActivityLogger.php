<?php

namespace App\Services;

use App\Enums\ActivityAction;
use App\Models\ActivityLog;
use App\Models\CloudConnection;
use App\Models\User;

class ActivityLogger
{
    /**
     * Record a user activity.
     *
     * @param  array<string, mixed>  $metadata
     */
    public function log(
        User $user,
        ActivityAction $action,
        string $subjectName,
        ?string $targetName = null,
        ?string $sourceName = null,
        ?CloudConnection $connection = null,
        array $metadata = [],
    ): ActivityLog {
        return ActivityLog::create([
            'user_id' => $user->id,
            'cloud_connection_id' => $connection?->id,
            'action' => $action,
            'subject_name' => $subjectName,
            'source_name' => $sourceName,
            'target_name' => $targetName,
            'metadata' => $metadata === [] ? null : $metadata,
            'created_at' => now(),
        ]);
    }
}
