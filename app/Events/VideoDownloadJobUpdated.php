<?php

declare(strict_types=1);

namespace App\Events;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class VideoDownloadJobUpdated implements ShouldBroadcastNow
{
    use Dispatchable;
    use InteractsWithSockets;
    use SerializesModels;

    /**
     * @param  array{job_id: string, status: string, progress: float, speed_str: string, eta_str: string, filename: string, error: string}  $jobData
     */
    public function __construct(
        public int $userId,
        public array $jobData,
    ) {}

    /**
     * @return array<int, PrivateChannel>
     */
    public function broadcastOn(): array
    {
        return [new PrivateChannel("users.{$this->userId}.video-jobs")];
    }

    public function broadcastAs(): string
    {
        return 'VideoDownloadJobUpdated';
    }

    /**
     * @return array{job_id: string, status: string, progress: float, speed_str: string, eta_str: string, filename: string, error: string}
     */
    public function broadcastWith(): array
    {
        return $this->jobData;
    }
}
