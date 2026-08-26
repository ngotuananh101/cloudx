<?php

namespace Database\Factories;

use App\Models\SavedCookie;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<SavedCookie>
 */
class SavedCookieFactory extends Factory
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
            'label' => fake()->word().' cookies',
            'cookies' => '.example.com	TRUE	/	FALSE	0	sid	'.fake()->sha256(),
            'created_at' => now(),
        ];
    }
}
