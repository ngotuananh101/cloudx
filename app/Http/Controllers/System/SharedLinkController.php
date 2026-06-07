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
        $shares = CloudShare::with('cloudConnection')
            ->where('user_id', $request->user()->id)
            ->orderBy('created_at', 'desc')
            ->paginate(15);

        return Inertia::render('system/shared-links/index', [
            'shares' => $shares,
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
