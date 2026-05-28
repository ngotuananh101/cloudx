<?php

namespace Database\Factories;

use App\Enums\CloudProvider;
use App\Enums\ConnectionStatus;
use App\Models\CloudConnection;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<CloudConnection>
 */
class CloudConnectionFactory extends Factory
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
            'name' => fake()->company().' Drive',
            'provider' => CloudProvider::GOOGLE_DRIVE,
            'credentials' => ['token' => fake()->sha256()],
            'status' => ConnectionStatus::CONNECTED,
            'total_space' => 1_000_000,
            'used_space' => 100_000,
            'error_message' => null,
            'last_synced_at' => null,
        ];
    }
}
