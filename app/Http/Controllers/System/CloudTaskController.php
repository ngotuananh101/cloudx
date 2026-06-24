<?php

namespace App\Http\Controllers\System;

use App\Http\Controllers\Controller;
use App\Models\CloudTask;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class CloudTaskController extends Controller
{
    public function __invoke(Request $request): Response
    {
        return Inertia::render('system/cloud-tasks/index', [
            'tasks' => Inertia::scroll(fn () => CloudTask::query()
                ->with('connection:id,name,provider,user_id')
                ->whereBelongsTo($request->user())
                ->latest('created_at')
                ->paginate(20)
                ->through(fn (CloudTask $task): array => [
                    'id' => $task->id,
                    'name' => $task->name,
                    'target_path' => $task->target_path,
                    'type' => $this->enumData($task->type),
                    'status' => $this->enumData($task->status),
                    'connection' => $task->connection ? [
                        'id' => $task->connection->id,
                        'name' => $task->connection->name,
                    ] : null,
                    'error_message' => $task->error_message,
                    'created_at' => $task->created_at?->toJSON(),
                    'updated_at' => $task->updated_at?->toJSON(),
                    'queued_at' => $task->queued_at?->toJSON(),
                    'processing_at' => $task->processing_at?->toJSON(),
                    'completed_at' => $task->completed_at?->toJSON(),
                    'failed_at' => $task->failed_at?->toJSON(),
                    'cancelled_at' => $task->cancelled_at?->toJSON(),
                ])),
        ]);
    }

    /**
     * @return array{value: int|string|null, key: string|null, label: string|null}
     */
    private function enumData(?\BackedEnum $enum): array
    {
        return [
            'value' => $enum?->value,
            'key' => $enum?->name,
            'label' => $enum?->getDescription(),
        ];
    }
}
