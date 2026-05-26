<?php

namespace App\Http\Controllers;

use App\Models\CloudConnection;
use App\Services\CloudStorage\CloudStorageCache;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class CloudFolderController extends Controller
{
    public function __construct(private CloudStorageCache $cache) {}

    public function store(Request $request, CloudConnection $connection): RedirectResponse
    {
        abort_if($connection->user_id !== $request->user()->id, 403, 'Unauthorized action.');

        $validated = $request->validate([
            'path' => ['nullable', 'string', 'max:2048'],
            'name' => ['required', 'string', 'max:255'],
        ]);

        $path = trim((string) ($validated['path'] ?? ''), '/');
        $name = trim((string) $validated['name']);

        if ($name === '' || str_contains($name, '/') || str_contains($name, '\\') || str_contains($name, '..')) {
            throw ValidationException::withMessages([
                'name' => 'Folder name is invalid.',
            ]);
        }

        $folderPath = $path === '' ? $name : $path.'/'.$name;

        $connection->getDisk()->createDirectory($folderPath);
        $this->cache->flushFolder($connection, $path);

        return back()->with('success', 'Folder created.');
    }
}
