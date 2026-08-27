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
use App\Http\Controllers\SavedCookieController;
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

// Internal Webhook from Python microservice (protected by Python service token)
Route::post('internal/video-downloader/progress', [VideoDownloaderController::class, 'progressWebhook'])->name('internal.video-downloader.progress');

// Public share routes (no auth required)
Route::controller(ShareViewController::class)->prefix('s/{uuid}')->name('share.')->group(function () {
    Route::get('/', 'index')->name('view');
    Route::post('verify', 'verify')->middleware('throttle:5,1')->name('verify');
    Route::get('preview/{path?}', 'preview')->where('path', '.*')->name('preview');
    Route::get('download/{path?}', 'download')->where('path', '.*')->name('download');
});

Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('/', HomeController::class)->name('home');
    Route::get('dashboard', HomeController::class)->name('dashboard');

    // System
    Route::prefix('system')->name('system.')->group(function () {
        Route::get('cloud-tasks', CloudTaskController::class)->name('cloud-tasks.index');
        Route::get('activity-logs', ActivityLogController::class)->name('activity-logs.index');
        Route::controller(SharedLinkController::class)->prefix('shared-links')->name('shared-links.')->group(function () {
            Route::get('/', 'index')->name('index');
            Route::delete('{shared_link}', 'destroy')->name('destroy');
        });
    });

    // Cloud Storage Browsing
    Route::get('storage/{connection}/{path?}', [StorageBrowserController::class, 'index'])->where('path', '.*')->name('storage.index');

    // OAuth
    Route::controller(CloudConnectionController::class)->prefix('oauth/{provider}')->name('oauth.')->group(function () {
        Route::get('redirect', 'redirect')->name('redirect');
        Route::get('callback', 'callback')->name('callback');
    });

    // Connections & Cloud Tasks
    Route::prefix('connections')->group(function () {
        // Direct connection actions (no {connection} parameter)
        Route::post('ftp', [FtpConnectionController::class, 'store'])->name('connections.ftp.store');
        Route::post('s3', [S3ConnectionController::class, 'store'])->name('connections.s3.store');
        Route::post('sftp', [SftpConnectionController::class, 'store'])->name('connections.sftp.store');
        Route::post('telegram', [TelegramConnectionController::class, 'store'])->name('connections.telegram.store');
        Route::post('telegram/request-code', [TelegramConnectionController::class, 'requestCode'])->name('connections.telegram.request-code');

        // Parameterized connection routes: /connections/{connection}
        Route::prefix('{connection}')->group(function () {
            // General connection management
            Route::controller(CloudConnectionController::class)->group(function () {
                Route::get('reconnect', 'reconnect')->name('cloud-connections.reconnect');
                Route::delete('/', 'disconnect')->name('cloud-connections.destroy');
                Route::patch('name', 'updateName')->name('cloud-connections.name.update');
                Route::get('edit-config', 'editConfig')->name('connections.edit-config');
            });

            // Provider config updates
            Route::patch('ftp', [FtpConnectionController::class, 'update'])->name('connections.ftp.update');
            Route::patch('s3', [S3ConnectionController::class, 'update'])->name('connections.s3.update');
            Route::patch('sftp', [SftpConnectionController::class, 'update'])->name('connections.sftp.update');
            Route::post('telegram/sync', [TelegramConnectionController::class, 'sync'])->name('connections.telegram.sync');

            // Cache & items
            Route::delete('cache', [CloudConnectionCacheController::class, 'destroy'])->name('cloud-connections.cache.destroy');
            Route::delete('items', [CloudItemController::class, 'destroy'])->name('connections.items.destroy');
            Route::post('move', CloudItemMoveController::class)->name('connections.items.move');

            // Files preview & download
            Route::prefix('files')->name('cloud.files.')->group(function () {
                Route::get('preview/{path?}', [CloudFilePreviewController::class, 'preview'])->where('path', '.*')->name('preview');
                Route::get('download/{path?}', [CloudFileDownloadController::class, 'download'])->where('path', '.*')->name('download');
            });

            // Folders
            Route::name('connections.folders.')->group(function () {
                Route::get('folders', [CloudFolderListController::class, 'index'])->name('index');
                Route::post('folders', [CloudFolderController::class, 'store'])->name('store');
            });

            // Shares
            Route::controller(CloudShareController::class)->prefix('shares')->name('connections.shares.')->group(function () {
                Route::get('/', 'index')->name('index');
                Route::post('/', 'store')->name('store');
                Route::delete('{share}', 'destroy')->name('destroy');
            });

            // Upload tasks & direct uploads
            Route::prefix('upload-tasks')->name('connections.upload-tasks.')->group(function () {
                Route::controller(CloudUploadTaskController::class)->group(function () {
                    Route::get('/', 'index')->name('index');
                    Route::post('/', 'store')->name('store');
                    Route::get('{task}', 'show')->name('show');
                    Route::patch('{task}/pause', 'pause')->name('pause');
                    Route::patch('{task}/resume', 'resume')->name('resume');
                    Route::delete('{task}', 'destroy')->name('destroy');
                });

                Route::post('{task}/chunks', [CloudUploadTaskChunkController::class, 'store'])->name('chunks.store');

                Route::prefix('{task}/direct')->group(function () {
                    Route::controller(CloudUploadPresignController::class)->name('direct.')->group(function () {
                        Route::post('init', 'init')->name('init');
                        Route::post('part', 'part')->name('part');
                    });
                    Route::controller(CloudUploadDirectCompleteController::class)->group(function () {
                        Route::post('parts/{partNumber}/done', 'partDone')->name('direct.parts.done');
                        Route::post('complete', 'complete')->name('direct.complete');
                        Route::delete('abort', 'abort')->name('direct.abort');
                    });
                });
            });
        });
    });

    // Video Downloader
    Route::controller(VideoDownloaderController::class)->prefix('video-downloader')->name('video-downloader.')->group(function () {
        Route::get('/', 'index')->name('index');
        Route::post('metadata', 'metadata')->name('metadata');
        Route::prefix('jobs')->name('jobs.')->group(function () {
            Route::post('/', 'startJob')->name('store');
            Route::get('{jobId}', 'jobStatus')->name('show');
            Route::get('{jobId}/download', 'jobDownload')->name('download');
        });
    });

    // Saved Cookies
    Route::controller(SavedCookieController::class)->prefix('saved-cookies')->name('saved-cookies.')->group(function () {
        Route::get('/', 'index')->name('index');
        Route::post('/', 'store')->name('store');
        Route::get('{savedCookie}', 'show')->name('show');
        Route::delete('{savedCookie}', 'destroy')->name('destroy');
    });
});
