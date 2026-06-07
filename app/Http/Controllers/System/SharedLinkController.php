<?php

namespace App\Http\Controllers\System;

use App\Http\Controllers\Controller;
use App\Models\CloudShare;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class SharedLinkController extends Controller
{
    /**
     * Display a listing of the shared links.
     */
    public function index(Request $request): Response
    {
        $query = CloudShare::with('cloudConnection')
            ->where('user_id', $request->user()->id);

        if ($request->filled('connection') && $request->connection !== 'all') {
            $query->where('cloud_connection_id', $request->connection);
        }

        if ($request->filled('access_type') && $request->access_type !== 'all') {
            $query->where('type', $request->access_type);
        }

        if ($request->filled('expires') && $request->expires !== 'all') {
            if ($request->expires === 'active') {
                $query->where(function ($q) {
                    $q->whereNull('expires_at')
                      ->orWhere('expires_at', '>', now());
                });
            } else {
                $query->whereNotNull('expires_at')->where('expires_at', '<=', now());
            }
        }

        if ($request->filled('name')) {
            $query->where('name', 'like', '%' . $request->name . '%');
        }

        if ($request->filled('url')) {
            $query->where('uuid', 'like', '%' . $request->url . '%');
        }

        if ($request->filled('created_date')) {
            $query->whereDate('created_at', $request->created_date);
        }

        $shares = $query->orderBy('created_at', 'desc')->paginate(15)->withQueryString();

        return Inertia::render('system/shared-links/index', [
            'shares' => $shares,
            'filters' => $request->only(['connection', 'access_type', 'expires', 'name', 'url', 'created_date']),
        ]);
    }

    /**
     * Remove the specified shared link from storage.
     */
    public function destroy(Request $request, CloudShare $shared_link): RedirectResponse
    {
        abort_if($shared_link->user_id !== $request->user()->id, 403, 'Unauthorized access to this share.');

        $shared_link->delete();

        return back()->with('success', 'Shared link deleted successfully.');
    }
}
