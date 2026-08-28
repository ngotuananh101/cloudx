<?php

declare(strict_types=1);

use App\Http\Controllers\VideoDownloaderController;
use App\Http\Middleware\VerifyPythonServiceToken;
use Illuminate\Support\Facades\Route;

Route::middleware([VerifyPythonServiceToken::class])->group(function () {
    Route::post('video-downloader/progress', [VideoDownloaderController::class, 'progressWebhook'])->name('api.video-downloader.progress');
});
