<?php

namespace Database\Factories;

use App\Enums\CloudTaskStatus;
use App\Enums\CloudTaskType;
use App\Models\CloudConnection;
use App\Models\CloudTask;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<CloudTask>
 */
class CloudTaskFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'cloud_connection_id' => fn (array $attributes): CloudConnectionFactory => CloudConnection::factory()->state([
                'user_id' => $attributes['user_id'],
            ]),
            'type' => CloudTaskType::Upload,
            'status' => CloudTaskStatus::Pending,
            'target_path' => '',
            'name' => fake()->word(),
            'payload' => [],
            'result' => null,
            'error_message' => null,
            'started_at' => null,
            'queued_at' => null,
            'processing_at' => null,
            'completed_at' => null,
            'failed_at' => null,
            'cancelled_at' => null,
        ];
    }

    public function upload(): static
    {
        return $this->state(fn (array $attributes): array => [
            'type' => CloudTaskType::Upload,
        ]);
    }
}
