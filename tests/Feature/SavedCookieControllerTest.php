<?php

use App\Models\SavedCookie;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('requires authentication for all saved-cookie endpoints', function () {
    $this->getJson(route('saved-cookies.index'))->assertUnauthorized();
    $this->postJson(route('saved-cookies.store'))->assertUnauthorized();
    $this->getJson(route('saved-cookies.show', 1))->assertUnauthorized();
    $this->deleteJson(route('saved-cookies.destroy', 1))->assertUnauthorized();
});

it('stores a saved cookie for the authenticated user', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->postJson(route('saved-cookies.store'), [
            'label' => 'YouTube main',
            'cookies' => '.youtube.com	TRUE	/	FALSE	0	sid	abc123',
        ])
        ->assertCreated()
        ->assertJson([
            'label' => 'YouTube main',
        ])
        ->assertJsonStructure(['id', 'label', 'created_at']);

    $this->assertDatabaseHas('saved_cookies', [
        'user_id' => $user->id,
        'label' => 'YouTube main',
    ]);
});

it('validates label and cookies are required when storing', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->postJson(route('saved-cookies.store'), [])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['label', 'cookies']);
});

it('validates label max length', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->postJson(route('saved-cookies.store'), [
            'label' => str_repeat('a', 256),
            'cookies' => 'sid=abc',
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['label']);
});

it('lists only cookies belonging to the authenticated user', function () {
    $user = User::factory()->create();
    $other = User::factory()->create();

    SavedCookie::factory()->for($user)->create(['label' => 'Mine']);
    SavedCookie::factory()->for($other)->create(['label' => 'Theirs']);

    $response = $this->actingAs($user)
        ->getJson(route('saved-cookies.index'))
        ->assertOk()
        ->json();

    expect($response)->toHaveCount(1);
    expect($response[0]['label'])->toBe('Mine');
});

it('does not leak cookies content in the index listing', function () {
    $user = User::factory()->create();

    SavedCookie::factory()->for($user)->create();

    $response = $this->actingAs($user)
        ->getJson(route('saved-cookies.index'))
        ->assertOk()
        ->json();

    expect($response[0])->not->toHaveKey('cookies');
    expect($response[0])->toHaveKeys(['id', 'label', 'created_at']);
});

it('shows a saved cookie with its content', function () {
    $user = User::factory()->create();

    $saved = SavedCookie::factory()->for($user)->create([
        'label' => 'YouTube',
        'cookies' => '.youtube.com	TRUE	/	FALSE	0	sid	xyz',
    ]);

    $this->actingAs($user)
        ->getJson(route('saved-cookies.show', $saved))
        ->assertOk()
        ->assertJson([
            'id' => $saved->id,
            'label' => 'YouTube',
            'cookies' => '.youtube.com	TRUE	/	FALSE	0	sid	xyz',
        ]);
});

it('prevents accessing another user cookies via show', function () {
    $user = User::factory()->create();
    $other = User::factory()->create();

    $saved = SavedCookie::factory()->for($other)->create();

    $this->actingAs($user)
        ->getJson(route('saved-cookies.show', $saved))
        ->assertForbidden();
});

it('deletes a saved cookie', function () {
    $user = User::factory()->create();

    $saved = SavedCookie::factory()->for($user)->create();

    $this->actingAs($user)
        ->deleteJson(route('saved-cookies.destroy', $saved))
        ->assertNoContent();

    $this->assertDatabaseMissing('saved_cookies', ['id' => $saved->id]);
});

it('prevents deleting another user cookies', function () {
    $user = User::factory()->create();
    $other = User::factory()->create();

    $saved = SavedCookie::factory()->for($other)->create();

    $this->actingAs($user)
        ->deleteJson(route('saved-cookies.destroy', $saved))
        ->assertForbidden();

    $this->assertDatabaseHas('saved_cookies', ['id' => $saved->id]);
});

it('returns cookies ordered by newest first', function () {
    $user = User::factory()->create();

    $old = SavedCookie::factory()->for($user)->create([
        'label' => 'Old',
        'created_at' => now()->subDay(),
    ]);
    $new = SavedCookie::factory()->for($user)->create([
        'label' => 'New',
        'created_at' => now(),
    ]);

    $response = $this->actingAs($user)
        ->getJson(route('saved-cookies.index'))
        ->assertOk()
        ->json();

    expect($response[0]['label'])->toBe('New');
    expect($response[1]['label'])->toBe('Old');
});
