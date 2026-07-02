<?php

namespace App\Http\Controllers\System;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class ActivityLogController extends Controller
{
    /**
     * The number of days of history exposed on this page.
     */
    private const RETENTION_DAYS = 90;

    public function __invoke(Request $request): Response
    {
        return Inertia::render('system/activity-logs/index', [
            'logs' => Inertia::scroll(fn () => ActivityLog::query()
                ->with('cloudConnection:id,name,provider')
                ->whereBelongsTo($request->user())
                ->where('created_at', '>=', now()->subDays(self::RETENTION_DAYS))
                ->latest('created_at')
                ->paginate(20)
                ->through(fn (ActivityLog $log): array => $log->toApiArray())),
            'retentionDays' => self::RETENTION_DAYS,
        ]);
    }
}
