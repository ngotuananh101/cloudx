<?php

namespace App\Http\Controllers;

use App\Models\CloudConnection;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;
use League\Flysystem\StorageAttributes;

class StorageBrowserController extends Controller
{
    public function index(CloudConnection $connection, string $path = '')
    {
        // Ensure user owns this connection
        abort_if($connection->user_id !== auth()->id(), 403, 'Unauthorized access to this connection.');

        // Decode path. URL-safe base64 decoding.
        $decodedPath = '';
        if ($path) {
            $decodedPath = base64_decode(str_replace(['-', '_'], ['+', '/'], $path));
            if ($decodedPath === false) {
                $decodedPath = '';
            }
        }

        $disk = $connection->getDisk();
        
        try {
            // listContents returns an iterable generator of StorageAttributes
            $contents = $disk->listContents($decodedPath, false);
            $files = [];
            foreach ($contents as $item) {
                /** @var StorageAttributes $item */
                $isDir = $item->isDir();
                $name = basename($item->path());
                
                // Exclude hidden files / system files
                if (str_starts_with($name, '.')) {
                    continue;
                }

                // Map standard extension to our UI types
                $type = 'other';
                if ($isDir) {
                    $type = 'folder';
                } else {
                    $ext = strtolower(pathinfo($name, PATHINFO_EXTENSION));
                    $type = match (true) {
                        in_array($ext, ['pdf', 'doc', 'docx', 'txt', 'md', 'rtf']) => 'document',
                        in_array($ext, ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp']) => 'image',
                        in_array($ext, ['js', 'ts', 'jsx', 'tsx', 'php', 'css', 'html', 'json']) => 'code',
                        in_array($ext, ['zip', 'rar', 'tar', 'gz', '7z']) => 'archive',
                        in_array($ext, ['mp4', 'mov', 'avi', 'mkv']) => 'video',
                        in_array($ext, ['mp3', 'wav', 'ogg']) => 'audio',
                        default => 'other',
                    };
                }

                $files[] = [
                    'id' => $item->path(), // Use the remote path as unique ID
                    'name' => $name,
                    'type' => $type,
                    'size' => $isDir ? 0 : $item->fileSize(),
                    'updatedAt' => $item->lastModified() ? date('M j, Y', $item->lastModified()) : '--',
                ];
            }

            // Sort logic: Folders first, then alphabetically
            usort($files, function($a, $b) {
                if ($a['type'] === 'folder' && $b['type'] !== 'folder') return -1;
                if ($a['type'] !== 'folder' && $b['type'] === 'folder') return 1;
                return strnatcasecmp($a['name'], $b['name']);
            });

        } catch (\Exception $e) {
            Log::error($e);
            // If the folder doesn't exist or token is invalid
            // We can return empty array and flash an error, or just fail gracefully.
            $files = [];
            session()->flash('error', 'Could not retrieve files. Error: ' . $e->getMessage());
        }

        return Inertia::render('files/index', [
            'connection' => [
                'id' => $connection->id,
                'name' => $connection->name,
                'provider' => $connection->provider->value,
            ],
            'currentPath' => $path, // Base64 path
            'decodedPath' => $decodedPath,
            'files' => $files,
        ]);
    }
}
