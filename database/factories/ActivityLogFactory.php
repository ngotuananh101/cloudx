<?php

namespace Database\Factories;

use App\Enums\ActivityAction;
use App\Models\ActivityLog;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<ActivityLog>
 */
class ActivityLogFactory extends Factory
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
            'cloud_connection_id' => null,
            'action' => ActivityAction::FileUploaded,
            'subject_name' => fake()->word().'.pdf',
            'source_name' => null,
            'target_name' => fake()->word(),
            'metadata' => null,
            'created_at' => now(),
        ];
    }
}
