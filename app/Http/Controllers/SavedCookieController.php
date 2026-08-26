<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\SavedCookie;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class SavedCookieController extends Controller
{
    /**
     * List saved cookies for the authenticated user (without content).
     */
    public function index(Request $request): JsonResponse
    {
        $cookies = SavedCookie::query()
            ->where('user_id', $request->user()->id)
            ->orderByDesc('created_at')
            ->get(['id', 'label', 'created_at']);

        return response()->json($cookies);
    }

    /**
     * Store a new saved cookie.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'label' => ['required', 'string', 'max:255'],
            'cookies' => ['required', 'string', 'max:65535'],
        ]);

        $savedCookie = SavedCookie::create([
            'user_id' => $request->user()->id,
            'label' => $validated['label'],
            'cookies' => $validated['cookies'],
        ]);

        return response()->json([
            'id' => $savedCookie->id,
            'label' => $savedCookie->label,
            'created_at' => $savedCookie->created_at?->toJSON(),
        ], 201);
    }

    /**
     * Show a saved cookie with its content (for filling the textarea).
     */
    public function show(Request $request, SavedCookie $savedCookie): JsonResponse
    {
        abort_if($savedCookie->user_id !== $request->user()->id, 403, 'Unauthorized access to this saved cookie.');

        return response()->json([
            'id' => $savedCookie->id,
            'label' => $savedCookie->label,
            'cookies' => $savedCookie->cookies,
        ]);
    }

    /**
     * Delete a saved cookie.
     */
    public function destroy(Request $request, SavedCookie $savedCookie): Response
    {
        abort_if($savedCookie->user_id !== $request->user()->id, 403, 'Unauthorized access to this saved cookie.');

        $savedCookie->delete();

        return response()->noContent();
    }
}
