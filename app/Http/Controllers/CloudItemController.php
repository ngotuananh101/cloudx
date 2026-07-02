<?php

namespace App\Http\Controllers;

use App\Enums\ActivityAction;
use App\Models\CloudConnection;
use App\Services\ActivityLogger;
use App\Services\CloudStorage\CloudStorageCache;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class CloudItemController extends Controller
{
    public function __construct(
        private CloudStorageCache $cache,
        private ActivityLogger $activityLogger,
    ) {}

    public function destroy(Request $request, CloudConnection $connection): RedirectResponse
    {
        abort_if($connection->user_id !== $request->user()->id, 403, 'Unauthorized action.');

        $validated = $request->validate([
            'path' => ['required_without:items', 'string', 'max:2048'],
            'is_directory' => ['required_with:path', 'boolean'],
            'items' => ['required_without:path', 'array', 'min:1', 'max:100'],
            'items.*.path' => ['required', 'string', 'max:2048'],
            'items.*.is_directory' => ['required', 'boolean'],
        ]);

        $items = $this->itemsFromValidated($validated);
        $disk = $connection->getDisk();
        $parentPaths = [];

        foreach ($items as $item) {
            $path = $item['path'];

            if ($path === '') {
                abort(400, 'Cannot delete root directory.');
            }

            if ($item['is_directory']) {
                $disk->deleteDirectory($path);
            } else {
                $disk->delete($path);
            }

            $this->activityLogger->log(
                user: $request->user(),
                action: ActivityAction::FileDeleted,
                subjectName: basename($path),
                connection: $connection,
            );

            $parentPaths[$this->parentPath($path)] = true;
        }

        foreach (array_keys($parentPaths) as $parentPath) {
            $this->cache->flushFolder($connection, $parentPath);
        }

        $count = count($items);

        return back()->with('success', $count === 1 ? 'Item deleted.' : "{$count} items deleted.");
    }

    /**
     * @param  array<string, mixed>  $validated
     * @return array<int, array{path: string, is_directory: bool}>
     */
    private function itemsFromValidated(array $validated): array
    {
        if (isset($validated['items']) && is_array($validated['items'])) {
            return collect($validated['items'])
                ->map(fn (array $item): array => [
                    'path' => trim((string) $item['path'], '/'),
                    'is_directory' => (bool) $item['is_directory'],
                ])
                ->values()
                ->all();
        }

        return [[
            'path' => trim((string) $validated['path'], '/'),
            'is_directory' => (bool) $validated['is_directory'],
        ]];
    }

    private function parentPath(string $path): string
    {
        $lastSlashPos = strrpos($path, '/');

        return $lastSlashPos === false ? '' : substr($path, 0, $lastSlashPos);
    }
}
