<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CloudConnection;
use App\Models\CloudShare;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class CloudShareController extends Controller
{
    public function index(Request $request, CloudConnection $connection): JsonResponse
    {
        abort_if($connection->user_id !== $request->user()->id, 403, 'Unauthorized access to this connection.');

        $request->validate([
            'path' => 'required|string',
        ]);

        $shares = CloudShare::where('cloud_connection_id', $connection->id)
            ->where('path', $request->query('path'))
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json($shares);
    }

    public function store(Request $request, CloudConnection $connection): RedirectResponse
    {
        abort_if($connection->user_id !== $request->user()->id, 403, 'Unauthorized access to this connection.');

        $validated = $request->validate([
            'path' => 'required|string',
            'name' => 'required|string',
            'is_directory' => 'required|boolean',
            'type' => 'required|string|in:public,password',
            'password' => 'required_if:type,password|nullable|string|min:4',
            'expires_in_days' => 'nullable|integer|min:1',
            'size' => 'nullable|integer|min:0',
        ]);

        $share = new CloudShare;
        $share->uuid = Str::uuid()->toString();
        $share->user_id = $request->user()->id;
        $share->cloud_connection_id = $connection->id;
        $share->path = $validated['path'];
        $share->name = $validated['name'];
        $share->is_directory = $validated['is_directory'];
        $share->type = $validated['type'];

        if (! $validated['is_directory'] && isset($validated['size'])) {
            $share->extra_info = ['size' => (int) $validated['size']];
        }

        if ($validated['type'] === 'password' && ! empty($validated['password'])) {
            $share->password = Hash::make($validated['password']);
        }

        if (! empty($validated['expires_in_days'])) {
            $share->expires_at = now()->addDays($validated['expires_in_days']);
        }

        $share->save();

        return back()->with('success', 'Share link created successfully.');
    }

    public function destroy(Request $request, CloudConnection $connection, CloudShare $share): RedirectResponse
    {
        abort_if($connection->user_id !== $request->user()->id, 403, 'Unauthorized access to this connection.');
        abort_if($share->cloud_connection_id !== $connection->id, 404, 'Share not found on this connection.');

        $share->delete();

        return back()->with('success', 'Share link deleted successfully.');
    }
}
