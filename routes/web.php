<?php

use Illuminate\Support\Facades\Route;

require __DIR__.'/auth.php';

Route::middleware(['auth', 'verified'])->group(function () {
    Route::inertia('/', 'dashboard')->name('home');
});
