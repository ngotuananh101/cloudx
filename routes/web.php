<?php

use App\Http\Controllers\Api\CloudFolderListController;
use App\Http\Controllers\Api\CloudShareController;
use App\Http\Controllers\CloudConnectionCacheController;
use App\Http\Controllers\CloudConnectionController;
use App\Http\Controllers\CloudFileDownloadController;
use App\Http\Controllers\CloudFilePreviewController;
use App\Http\Controllers\CloudFolderController;
use App\Http\Controllers\CloudItemController;
use App\Http\Controllers\CloudItemMoveController;
use App\Http\Controllers\CloudUploadDirectCompleteController;
use App\Http\Controllers\CloudUploadPresignController;
use App\Http\Controllers\CloudUploadTaskChunkController;
use App\Http\Controllers\CloudUploadTaskController;
use App\Http\Controllers\FtpConnectionController;
use App\Http\Controllers\HomeController;
use App\Http\Controllers\S3ConnectionController;
use App\Http\Controllers\SftpConnectionController;
use App\Http\Controllers\ShareViewController;
use App\Http\Controllers\StorageBrowserController;
use App\Http\Controllers\System\ActivityLogController;
use App\Http\Controllers\System\CloudTaskController;
use App\Http\Controllers\System\SharedLinkController;
use App\Http\Controllers\TelegramConnectionController;
use App\Http\Controllers\VideoDownloaderController;
use Illuminate\Support\Facades\Route;

require __DIR__.'/auth.php';

// Public share routes (no auth required)
Route::prefix('s')->group(function () {
    Route::get('{uuid}', [ShareViewController::class, 'index'])->name('share.view');
    Route::post('{uuid}/verify', [ShareViewController::class, 'verify'])->name('share.verify');
    Route::get('{uuid}/preview/{path?}', [ShareViewController::class, 'preview'])
        ->name('share.preview')
        ->where('path', '.*');
    Route::get('{uuid}/download/{path?}', [ShareViewController::class, 'download'])
        ->name('share.download')
        ->where('path', '.*');
});

Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('/', HomeController::class)->name('home');
    Route::get('/dashboard', HomeController::class)->name('dashboard');
    Route::get('/system/cloud-tasks', CloudTaskController::class)->name('system.cloud-tasks.index');
    Route::get('/system/activity-logs', ActivityLogController::class)->name('system.activity-logs.index');

    Route::get('/system/shared-links', [SharedLinkController::class, 'index'])->name('system.shared-links.index');
    Route::delete('/system/shared-links/{shared_link}', [SharedLinkController::class, 'destroy'])->name('system.shared-links.destroy');

    // Cloud Storage Browsing Route
    Route::get('/storage/{connection}/{path?}', [StorageBrowserController::class, 'index'])
        ->name('storage.index')
        ->where('path', '.*');

    Route::get('/connections/{connection}/files/download/{path?}', [CloudFileDownloadController::class, 'download'])
        ->name('cloud.files.download')
        ->where('path', '.*');

    Route::get('/connections/{connection}/files/preview/{path?}', [CloudFilePreviewController::class, 'preview'])
        ->name('cloud.files.preview')
        ->where('path', '.*');

    // Cloud Connections OAuth Flow
    Route::controller(CloudConnectionController::class)->group(function () {
        Route::get('/oauth/{provider}/redirect', 'redirect')->name('oauth.redirect');
        Route::get('/oauth/{provider}/callback', 'callback')->name('oauth.callback');
        Route::get('/connections/{connection}/reconnect', 'reconnect')->name('cloud-connections.reconnect');
        Route::delete('/connections/{connection}', 'disconnect')->name('cloud-connections.destroy');
        Route::patch('/connections/{connection}/name', 'updateName')->name('cloud-connections.name.update');
    });
    Route::post('/connections/ftp', [FtpConnectionController::class, 'store'])->name('connections.ftp.store');
    Route::patch('/connections/{connection}/ftp', [FtpConnectionController::class, 'update'])->name('connections.ftp.update');
    Route::post('/connections/s3', [S3ConnectionController::class, 'store'])->name('connections.s3.store');
    Route::patch('/connections/{connection}/s3', [S3ConnectionController::class, 'update'])->name('connections.s3.update');
    Route::post('/connections/sftp', [SftpConnectionController::class, 'store'])->name('connections.sftp.store');
    Route::patch('/connections/{connection}/sftp', [SftpConnectionController::class, 'update'])->name('connections.sftp.update');
    Route::controller(TelegramConnectionController::class)->group(function () {
        Route::post('/connections/telegram/request-code', 'requestCode')->name('connections.telegram.request-code');
        Route::post('/connections/telegram', 'store')->name('connections.telegram.store');
        Route::post('/connections/{connection}/telegram/sync', 'sync')->name('connections.telegram.sync');
    });
    Route::delete('/connections/{connection}/cache', [CloudConnectionCacheController::class, 'destroy'])->name('cloud-connections.cache.destroy');
    Route::delete('/connections/{connection}/items', [CloudItemController::class, 'destroy'])->name('connections.items.destroy');
    Route::post('/connections/{connection}/folders', [CloudFolderController::class, 'store'])->name('connections.folders.store');
    Route::get('/connections/{connection}/folders', [CloudFolderListController::class, 'index'])->name('connections.folders.index');
    Route::get('/connections/{connection}/shares', [CloudShareController::class, 'index'])->name('connections.shares.index');
    Route::post('/connections/{connection}/shares', [CloudShareController::class, 'store'])->name('connections.shares.store');
    Route::delete('/connections/{connection}/shares/{share}', [CloudShareController::class, 'destroy'])->name('connections.shares.destroy');
    Route::post('/connections/{connection}/move', CloudItemMoveController::class)->name('connections.items.move');

    Route::controller(CloudUploadTaskController::class)->group(function () {
        Route::get('/connections/{connection}/upload-tasks', 'index')->name('connections.upload-tasks.index');
        Route::post('/connections/{connection}/upload-tasks', 'store')->name('connections.upload-tasks.store');
        Route::get('/connections/{connection}/upload-tasks/{task}', 'show')->name('connections.upload-tasks.show');
        Route::patch('/connections/{connection}/upload-tasks/{task}/pause', 'pause')->name('connections.upload-tasks.pause');
        Route::patch('/connections/{connection}/upload-tasks/{task}/resume', 'resume')->name('connections.upload-tasks.resume');
        Route::delete('/connections/{connection}/upload-tasks/{task}', 'destroy')->name('connections.upload-tasks.destroy');
    });
    Route::post('/connections/{connection}/upload-tasks/{task}/chunks', [CloudUploadTaskChunkController::class, 'store'])->name('connections.upload-tasks.chunks.store');
    Route::post('/connections/{connection}/upload-tasks/{task}/direct/init', [CloudUploadPresignController::class, 'init'])->name('connections.upload-tasks.direct.init');
    Route::post('/connections/{connection}/upload-tasks/{task}/direct/part', [CloudUploadPresignController::class, 'part'])->name('connections.upload-tasks.direct.part');
    Route::controller(CloudUploadDirectCompleteController::class)->group(function () {
        Route::post('/connections/{connection}/upload-tasks/{task}/direct/parts/{partNumber}/done', 'partDone')->name('connections.upload-tasks.direct.parts.done');
        Route::post('/connections/{connection}/upload-tasks/{task}/direct/complete', 'complete')->name('connections.upload-tasks.direct.complete');
        Route::delete('/connections/{connection}/upload-tasks/{task}/direct/abort', 'abort')->name('connections.upload-tasks.direct.abort');
    });

    Route::controller(VideoDownloaderController::class)->group(function () {
        Route::get('/video-downloader', 'index')->name('video-downloader.index');
        Route::post('/video-downloader/metadata', 'metadata')->name('video-downloader.metadata');
        Route::get('/video-downloader/download', 'download')->name('video-downloader.download');
    });
});
