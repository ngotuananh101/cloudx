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
            'source_path' => ['required_without:items', 'string', 'max:2048'],
            'is_directory' => ['sometimes', 'boolean'],
            'destination_folder' => ['nullable', 'string', 'max:2048'],
            'items' => ['required_without:source_path', 'array', 'min:1', 'max:100'],
            'items.*.path' => ['required', 'string', 'max:2048'],
            'items.*.is_directory' => ['required', 'boolean'],
        ]);

        $destinationFolder = trim((string) ($validated['destination_folder'] ?? ''), '/');
        $items = $this->itemsFromValidated($validated);

        foreach ($items as $index => $item) {
            $this->validateMoveItem($item, $destinationFolder, $index);
        }

        $disk = $connection->getDisk();
        $flushedPaths = [$destinationFolder => true];
        $movedCount = 0;

        foreach ($items as $item) {
            $sourcePath = $item['path'];
            $destinationPath = $this->destinationPath($sourcePath, $destinationFolder);

            if ($sourcePath === $destinationPath) {
                continue;
            }

            try {
                $disk->move($sourcePath, $destinationPath);
            } catch (\Throwable $e) {
                return back()->with('error', 'Failed to move item: '.$e->getMessage());
            }

            $flushedPaths[$this->parentPath($sourcePath)] = true;
            $movedCount++;
        }

        foreach (array_keys($flushedPaths) as $path) {
            $this->cache->flushFolder($connection, $path);
        }

        return back()->with('success', $movedCount === 1 ? 'Item moved.' : "{$movedCount} items moved.");
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
            'path' => trim((string) $validated['source_path'], '/'),
            'is_directory' => (bool) ($validated['is_directory'] ?? true),
        ]];
    }

    /**
     * @param  array{path: string, is_directory: bool}  $item
     */
    private function validateMoveItem(array $item, string $destinationFolder, int $index): void
    {
        $sourcePath = $item['path'];

        if ($sourcePath === '') {
            throw ValidationException::withMessages([
                $index === 0 ? 'source_path' : "items.{$index}.path" => 'Cannot move root directory.',
            ]);
        }

        if ($item['is_directory'] && ($sourcePath === $destinationFolder || str_starts_with($destinationFolder.'/', $sourcePath.'/'))) {
            throw ValidationException::withMessages([
                'destination_folder' => 'Cannot move a folder into itself or its subfolders.',
            ]);
        }
    }

    private function destinationPath(string $sourcePath, string $destinationFolder): string
    {
        $itemName = basename($sourcePath);

        return $destinationFolder === '' ? $itemName : $destinationFolder.'/'.$itemName;
    }

    private function parentPath(string $path): string
    {
        $lastSlashPos = strrpos($path, '/');

        return $lastSlashPos === false ? '' : substr($path, 0, $lastSlashPos);
    }
}
