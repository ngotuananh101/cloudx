<?php

namespace App\Providers;

use App\Services\Python\PythonServiceClient;
use App\Services\Python\YtDlpClient;
use App\Services\Telegram\TelegramClient;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\ServiceProvider;
use Illuminate\Validation\Rules\Password;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(PythonServiceClient::class, function () {
            return new PythonServiceClient(
                url: (string) config('services.python-service.url'),
                token: (string) config('services.python-service.token'),
            );
        });

        $this->app->singleton(TelegramClient::class, function ($app) {
            $base = $app->make(PythonServiceClient::class);

            return new TelegramClient(
                url: $base->url(),
                token: $base->token(),
                sessionId: '',
            );
        });

        $this->app->singleton(YtDlpClient::class, function ($app) {
            $base = $app->make(PythonServiceClient::class);

            return new YtDlpClient(
                url: $base->url(),
                token: $base->token(),
            );
        });
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        $this->configureDefaults();
    }

    /**
     * Configure default behaviors for production-ready applications.
     */
    protected function configureDefaults(): void
    {
        Date::use(CarbonImmutable::class);

        DB::prohibitDestructiveCommands(
            app()->isProduction(),
        );

        Password::defaults(fn (): ?Password => app()->isProduction()
            ? Password::min(12)
                ->mixedCase()
                ->letters()
                ->numbers()
                ->symbols()
                ->uncompromised()
            : null,
        );
    }
}
