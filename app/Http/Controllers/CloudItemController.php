<?php

namespace App\Http\Controllers;

use App\Models\CloudConnection;
use App\Services\CloudStorage\CloudStorageCache;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class CloudItemController extends Controller
{
    public function __construct(private CloudStorageCache $cache) {}

    public function destroy(Request $request, CloudConnection $connection): RedirectResponse
    {
        abort_if($connection->user_id !== $request->user()->id, 403, 'Unauthorized action.');

        $validated = $request->validate([
            'path' => ['required', 'string', 'max:2048'],
            'is_directory' => ['required', 'boolean'],
        ]);

        $path = trim((string) $validated['path'], '/');
        $isDirectory = (bool) $validated['is_directory'];

        if ($path === '') {
            abort(400, 'Cannot delete root directory.');
        }

        $disk = $connection->getDisk();

        if ($isDirectory) {
            $disk->deleteDirectory($path);
        } else {
            $disk->delete($path);
        }

        // The parent path is everything up to the last slash
        $parentPath = '';
        $lastSlashPos = strrpos($path, '/');
        if ($lastSlashPos !== false) {
            $parentPath = substr($path, 0, $lastSlashPos);
        }

        $this->cache->flushFolder($connection, $parentPath);

        return back()->with('success', 'Item deleted.');
    }
}
