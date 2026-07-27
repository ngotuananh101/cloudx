<?php

namespace App\Http\Middleware;

use App\Enums\CloudProvider;
use App\Models\CloudConnection;
use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that's loaded on the first page visit.
     *
     * @see https://inertiajs.com/server-side-setup#root-template
     *
     * @var string
     */
    protected $rootView = 'app';

    /**
     * Define the props that are shared by default.
     *
     * @see https://inertiajs.com/shared-data
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        return [
            ...parent::share($request),
            'name' => config('app.name'),
            'auth' => [
                'user' => $request->user() ? [
                    'id' => $request->user()->id,
                    'name' => $request->user()->name,
                    'email' => $request->user()->email,
                    'connections' => $request->user()->cloudConnections()
                        ->latest()
                        ->get()
                        ->map(function (CloudConnection $connection): array {
                            return [
                                'id' => $connection->id,
                                'name' => $connection->name,
                                'provider' => $connection->provider->getDescription(),
                                'provider_value' => $connection->provider->value,
                                'provider_icon' => CloudProvider::getIcon($connection->provider->value),
                                'status' => $connection->status->getDescription(),
                                'status_value' => $connection->status->value,
                                'actions' => $connection->actions(),
                            ];
                        }),
                ] : null,
            ],
            'status' => fn () => $request->session()->get('status'),
            'max_preview_size' => config('app.max_preview_size'),
        ];
    }
}
