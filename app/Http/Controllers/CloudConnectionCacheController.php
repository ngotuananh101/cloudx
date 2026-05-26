<?php

namespace App\Http\Controllers;

use App\Models\CloudConnection;
use App\Services\CloudStorage\CloudStorageCache;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class CloudConnectionCacheController extends Controller
{
    public function __construct(private CloudStorageCache $cache) {}

    public function destroy(Request $request, CloudConnection $connection): RedirectResponse
    {
        abort_if($connection->user_id !== $request->user()->id, 403, 'Unauthorized action.');

        $path = $request->string('path')->toString();

        if ($path !== '') {
            $this->cache->flushFolder($connection, $path);
        } else {
            $this->cache->flushConnection($connection);
        }

        return back()->with('success', 'Cloud cache refreshed.');
    }
}
