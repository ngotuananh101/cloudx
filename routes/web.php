<?php

use App\Http\Controllers\CloudConnectionCacheController;
use App\Http\Controllers\CloudConnectionController;
use App\Http\Controllers\HomeController;
use Illuminate\Support\Facades\Route;

require __DIR__.'/auth.php';

use App\Http\Controllers\StorageBrowserController;

Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('/', HomeController::class)->name('home');
    Route::get('/dashboard', HomeController::class)->name('dashboard');

    // Cloud Storage Browsing Route
    Route::get('/storage/{connection}/{path?}', [StorageBrowserController::class, 'index'])
        ->name('storage.index')
        ->where('path', '.*');
    // Cloud Connections OAuth Flow
    Route::get('/oauth/{provider}/redirect', [CloudConnectionController::class, 'redirect'])->name('oauth.redirect');
    Route::get('/oauth/{provider}/callback', [CloudConnectionController::class, 'callback'])->name('oauth.callback');
    Route::delete('/connections/{connection}', [CloudConnectionController::class, 'disconnect'])->name('cloud-connections.destroy');
    Route::delete('/connections/{connection}/cache', [CloudConnectionCacheController::class, 'destroy'])->name('cloud-connections.cache.destroy');
});
