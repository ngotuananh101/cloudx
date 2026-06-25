<?php

namespace App\Http\Controllers;

use App\Models\CloudConnection;
use App\Services\CloudStorage\CloudStorageCache;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class CloudItemMoveController extends Controller
{
    public function __construct(private CloudStorageCache $cache) {}

    public function __invoke(Request $request, CloudConnection $connection): RedirectResponse
    {
        abort_if($connection->user_id !== $request->user()->id, 403, 'Unauthorized action.');

        $validated = $request->validate([
            'source_path' => ['required', 'string', 'max:2048'],
            'destination_folder' => ['nullable', 'string', 'max:2048'],
        ]);

        $sourcePath = trim((string) $validated['source_path'], '/');
        $destinationFolder = trim((string) ($validated['destination_folder'] ?? ''), '/');

        if ($sourcePath === '') {
            throw ValidationException::withMessages([
                'source_path' => 'Cannot move root directory.',
            ]);
        }

        if ($sourcePath === $destinationFolder || str_starts_with($destinationFolder.'/', $sourcePath.'/')) {
            throw ValidationException::withMessages([
                'destination_folder' => 'Cannot move a folder into itself or its subfolders.',
            ]);
        }

        $itemName = basename($sourcePath);
        $destinationPath = $destinationFolder === '' ? $itemName : $destinationFolder.'/'.$itemName;

        if ($sourcePath === $destinationPath) {
            return back()->with('success', 'Item moved.');
        }

        $disk = $connection->getDisk();

        try {
            $disk->move($sourcePath, $destinationPath);
        } catch (\Throwable $e) {
            return back()->with('error', 'Failed to move item: '.$e->getMessage());
        }

        // Flush cache for source parent folder
        $sourceParentPath = '';
        $lastSlashPos = strrpos($sourcePath, '/');
        if ($lastSlashPos !== false) {
            $sourceParentPath = substr($sourcePath, 0, $lastSlashPos);
        }
        $this->cache->flushFolder($connection, $sourceParentPath);

        // Flush cache for destination folder
        $this->cache->flushFolder($connection, $destinationFolder);

        return back()->with('success', 'Item moved.');
    }
}
