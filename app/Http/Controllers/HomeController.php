<?php

namespace App\Http\Controllers;

use App\Enums\CloudProvider;
use App\Models\CloudConnection;
use App\Services\CloudStorage\CloudStorageManager;
use Illuminate\Http\Request;

class HomeController extends Controller
{
    public function __construct(private CloudStorageManager $cloudStorageManager) {}

    /**
     * Handle the incoming request.
     */
    public function __invoke(Request $request)
    {
        $connections = $request->user()->cloudConnections()
            ->latest()
            ->get()
            ->map(function (CloudConnection $connection) {
                return [
                    'id' => $connection->id,
                    'name' => $connection->name,
                    'provider' => $connection->provider->description,
                    'provider_value' => $connection->provider->value,
                    'provider_icon' => CloudProvider::getIcon($connection->provider->value),
                    'status' => $connection->status->description,
                    'status_value' => $connection->status->value,
                    'used_space' => $connection->used_space,
                    'total_space' => $connection->total_space,
                    'used_formatted' => $this->formatBytes($connection->used_space),
                    'total_formatted' => $this->formatBytes($connection->total_space),
                    'percent' => $connection->total_space > 0
                        ? round(($connection->used_space / $connection->total_space) * 100, 1)
                        : 0,
                ];
            });

        return inertia('dashboard', [
            'connections' => $connections,
            'availableProviders' => $this->availableProviders(),
        ]);
    }

    /**
     * @return array<int, array{key: string, label: string, value: int, icon: string, status: string, authType: 'oauth'|'credentials', redirectUrl: string|null, capabilities: array{browse: bool, upload: bool, download: bool, delete: bool, createFolder: bool, share: bool}}>
     */
    public function availableProviders(): array
    {
        return collect($this->cloudStorageManager->connectors())
            ->map(function ($connector): array {
                $provider = $connector->provider();
                $authType = $provider->is(CloudProvider::FTP)
                    || $provider->is(CloudProvider::AWS_S3)
                    || $provider->is(CloudProvider::SFTP)
                    || $provider->is(CloudProvider::TELEGRAM)
                    ? 'credentials'
                    : 'oauth';

                return [
                    'key' => $provider->slug(),
                    'label' => $provider->description,
                    'value' => $provider->value,
                    'icon' => CloudProvider::getIcon($provider->value),
                    'status' => 'active',
                    'authType' => $authType,
                    'redirectUrl' => $authType === 'oauth'
                        ? route('oauth.redirect', ['provider' => $provider->slug()])
                        : null,
                    'capabilities' => $connector->capabilities()->toArray(),
                ];
            })
            ->values()
            ->all();
    }

    /**
     * Format bytes to a human-readable string.
     */
    private function formatBytes(?int $bytes, int $precision = 1): string
    {
        if ($bytes === null || $bytes <= 0) {
            return '0 B';
        }

        $units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
        $bytes = max($bytes, 0);
        $pow = floor(($bytes ? log($bytes) : 0) / log(1024));
        $pow = min($pow, count($units) - 1);

        $bytes /= pow(1024, $pow);

        return round($bytes, $precision).' '.$units[$pow];
    }
}
