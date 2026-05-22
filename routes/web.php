<?php

use App\Http\Controllers\CloudConnectionController;
use App\Http\Controllers\HomeController;
use Illuminate\Support\Facades\Route;

require __DIR__.'/auth.php';

use App\Http\Controllers\StorageBrowserController;

Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('/', HomeController::class)->name('home');
    Route::get('/dashboard', HomeController::class)->name('dashboard');
    
    // Cloud Storage Browsing Route
    Route::get('/s/{connection}/{path?}', [StorageBrowserController::class, 'index'])
        ->name('storage.index')
        ->where('path', '.*');
    // Cloud Connections OAuth Flow
    Route::get('/oauth/google/redirect', [CloudConnectionController::class, 'redirectToGoogle'])->name('oauth.google.redirect');
    Route::get('/oauth/google/callback', [CloudConnectionController::class, 'handleGoogleCallback'])->name('oauth.google.callback');
    Route::delete('/cloud-connections/{connection}', [CloudConnectionController::class, 'disconnect'])->name('cloud-connections.destroy');
});
