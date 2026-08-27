<?php

use App\Http\Controllers\Auth\ForgotPasswordController;
use App\Http\Controllers\Auth\LoginController;
use App\Http\Controllers\Auth\ResetPasswordController;
use App\Http\Controllers\Auth\VerifyEmailController;
use Illuminate\Support\Facades\Route;

Route::middleware('guest')->group(function () {
    Route::controller(LoginController::class)->group(function () {
        Route::get('login', 'create')->name('login');
        Route::post('login', 'store')->name('login.store');
    });

    Route::controller(ForgotPasswordController::class)->prefix('forgot-password')->name('password.')->group(function () {
        Route::get('/', 'create')->name('request');
        Route::post('/', 'store')->name('email');
    });

    Route::controller(ResetPasswordController::class)->prefix('reset-password')->name('password.')->group(function () {
        Route::get('{token}', 'create')->name('reset');
        Route::post('/', 'store')->name('update');
    });
});

Route::middleware('auth')->group(function () {
    Route::controller(VerifyEmailController::class)->group(function () {
        Route::get('verify-email', 'show')->name('verification.notice');
        Route::get('verify-email/{id}/{hash}', 'verify')->middleware(['signed', 'throttle:6,1'])->name('verification.verify');
        Route::post('email/verification-notification', 'resend')->middleware('throttle:6,1')->name('verification.send');
    });

    Route::post('logout', [LoginController::class, 'destroy'])->name('logout');
});
