<?php

namespace App\Services\CloudStorage\Contracts;

use App\Data\ConnectedAccountData;
use App\Data\ProviderCapabilities;
use App\Enums\CloudProvider;
use App\Models\CloudConnection;
use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Http\Request;

interface CloudProviderConnector
{
    public function provider(): CloudProvider;

    public function redirectUrl(): string;

    public function handleCallback(Request $request): ConnectedAccountData;

    public function disk(CloudConnection $connection): Filesystem;

    public function capabilities(): ProviderCapabilities;
}
