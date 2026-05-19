<?php

use App\Models\User;
use Inertia\Testing\AssertableInertia;

test('returns a successful response', function () {
    $user = User::factory()->create();

    $response = $this->actingAs($user)->get(route('home'));

    $response->assertOk();
    $response->assertInertia(fn (AssertableInertia $page) => $page
        ->component('dashboard')
        ->has('connections')
    );
});
