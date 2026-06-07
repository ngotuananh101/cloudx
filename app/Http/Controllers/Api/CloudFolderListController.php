<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CloudConnection;
use App\Services\CloudStorage\CloudFileBrowser;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CloudFolderListController extends Controller
{
    public function __construct(private CloudFileBrowser $fileBrowser) {}

    public function index(Request $request, CloudConnection $connection): JsonResponse
    {
        abort_if($connection->user_id !== $request->user()->id, 403, 'Unauthorized access to this connection.');

        $path = $request->query('path', '');
        
        try {
            $files = $this->fileBrowser->list($connection, (string) $path);
            
            // Filter only directories
            $folders = array_values(array_filter($files, fn ($file) => $file->isDirectory));
            
            return response()->json($folders);
        } catch (\Throwable $exception) {
            return response()->json(['error' => 'Could not retrieve folders', 'message' => $exception->getMessage()], 500);
        }
    }
}

