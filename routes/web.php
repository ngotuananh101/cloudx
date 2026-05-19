<?php

use App\Http\Controllers\CloudConnectionController;
use Illuminate\Support\Facades\Route;

require __DIR__.'/auth.php';

Route::middleware(['auth', 'verified'])->group(function () {
    Route::inertia('/', 'dashboard')->name('home');
    Route::inertia('/dashboard', 'dashboard')->name('dashboard');

    // Cloud Connections OAuth Flow
    Route::get('/oauth/google/redirect', [CloudConnectionController::class, 'redirectToGoogle'])->name('oauth.google.redirect');
    Route::get('/oauth/google/callback', [CloudConnectionController::class, 'handleGoogleCallback'])->name('oauth.google.callback');
    Route::delete('/cloud-connections/{connection}', [CloudConnectionController::class, 'disconnect'])->name('cloud-connections.destroy');
});
