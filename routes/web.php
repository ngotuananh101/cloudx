<?php

use App\Http\Controllers\CloudConnectionCacheController;
use App\Http\Controllers\CloudConnectionController;
use App\Http\Controllers\CloudFileDownloadController;
use App\Http\Controllers\CloudFolderController;
use App\Http\Controllers\CloudUploadTaskChunkController;
use App\Http\Controllers\CloudUploadTaskController;
use App\Http\Controllers\FtpConnectionController;
use App\Http\Controllers\HomeController;
use App\Http\Controllers\SftpConnectionController;
use App\Http\Controllers\StorageBrowserController;
use App\Http\Controllers\TelegramConnectionController;
use App\Http\Controllers\System\CloudTaskController;
use Illuminate\Support\Facades\Route;

require __DIR__.'/auth.php';

Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('/', HomeController::class)->name('home');
    Route::get('/dashboard', HomeController::class)->name('dashboard');
    Route::get('/system/cloud-tasks', CloudTaskController::class)->name('system.cloud-tasks.index');

    // Cloud Storage Browsing Route
    Route::get('/storage/{connection}/{path?}', [StorageBrowserController::class, 'index'])
        ->name('storage.index')
        ->where('path', '.*');

    Route::get('/connections/{connection}/files/download/{path?}', [CloudFileDownloadController::class, 'download'])
        ->name('cloud.files.download')
        ->where('path', '.*');

    // Cloud Connections OAuth Flow
    Route::get('/oauth/{provider}/redirect', [CloudConnectionController::class, 'redirect'])->name('oauth.redirect');
    Route::get('/oauth/{provider}/callback', [CloudConnectionController::class, 'callback'])->name('oauth.callback');
    Route::get('/connections/{connection}/reconnect', [CloudConnectionController::class, 'reconnect'])->name('cloud-connections.reconnect');
    Route::delete('/connections/{connection}', [CloudConnectionController::class, 'disconnect'])->name('cloud-connections.destroy');
    Route::patch('/connections/{connection}/name', [CloudConnectionController::class, 'updateName'])->name('cloud-connections.name.update');
    Route::post('/connections/ftp', [FtpConnectionController::class, 'store'])->name('connections.ftp.store');
    Route::patch('/connections/{connection}/ftp', [FtpConnectionController::class, 'update'])->name('connections.ftp.update');
    Route::post('/connections/sftp', [SftpConnectionController::class, 'store'])->name('connections.sftp.store');
    Route::patch('/connections/{connection}/sftp', [SftpConnectionController::class, 'update'])->name('connections.sftp.update');
    Route::post('/connections/telegram/request-code', [TelegramConnectionController::class, 'requestCode'])->name('connections.telegram.request-code');
    Route::post('/connections/telegram', [TelegramConnectionController::class, 'store'])->name('connections.telegram.store');
    Route::delete('/connections/{connection}/cache', [CloudConnectionCacheController::class, 'destroy'])->name('cloud-connections.cache.destroy');
    Route::post('/connections/{connection}/folders', [CloudFolderController::class, 'store'])->name('connections.folders.store');

    Route::get('/connections/{connection}/upload-tasks', [CloudUploadTaskController::class, 'index'])->name('connections.upload-tasks.index');
    Route::post('/connections/{connection}/upload-tasks', [CloudUploadTaskController::class, 'store'])->name('connections.upload-tasks.store');
    Route::get('/connections/{connection}/upload-tasks/{task}', [CloudUploadTaskController::class, 'show'])->name('connections.upload-tasks.show');
    Route::patch('/connections/{connection}/upload-tasks/{task}/pause', [CloudUploadTaskController::class, 'pause'])->name('connections.upload-tasks.pause');
    Route::patch('/connections/{connection}/upload-tasks/{task}/resume', [CloudUploadTaskController::class, 'resume'])->name('connections.upload-tasks.resume');
    Route::delete('/connections/{connection}/upload-tasks/{task}', [CloudUploadTaskController::class, 'destroy'])->name('connections.upload-tasks.destroy');
    Route::post('/connections/{connection}/upload-tasks/{task}/chunks', [CloudUploadTaskChunkController::class, 'store'])->name('connections.upload-tasks.chunks.store');
});
