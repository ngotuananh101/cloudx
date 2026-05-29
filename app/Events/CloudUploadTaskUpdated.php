<?php

namespace App\Events;

use App\Models\CloudTask;
use App\Support\CloudUploadTaskData;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class CloudUploadTaskUpdated implements ShouldBroadcastNow
{
    use Dispatchable;
    use InteractsWithSockets;
    use SerializesModels;

    public function __construct(public CloudTask $task) {}

    /**
     * @return array<int, PrivateChannel>
     */
    public function broadcastOn(): array
    {
        return [new PrivateChannel("users.{$this->task->user_id}.cloud-tasks")];
    }

    public function broadcastAs(): string
    {
        return 'CloudUploadTaskUpdated';
    }

    /**
     * @return array<string, mixed>
     */
    public function broadcastWith(): array
    {
        return CloudUploadTaskData::fromTask($this->task);
    }
}
