import { Pause, Play, RotateCcw, X, ChevronDown, ChevronUp, Trash2, HardDrive } from 'lucide-react';
import { useState } from 'react';
import { usePage } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useUploadManager } from '@/contexts/UploadManagerContext';
import { formatBytes } from '@/lib/format-bytes';
import type { UploadQueueItem, CloudConnection } from '@/types/cloud';

const ACTIVE_STATUSES: UploadQueueItem['status'][] = [
    'pending',
    'uploading',
    'paused',
    'queued',
    'processing',
];

function getStatusLabel(item: UploadQueueItem): string {
    if (item.status === 'uploading' && item.file) {
        const uploadedBytes = Math.round(
            (item.progress / 100) * item.file.size,
        );

        return `Uploading ${formatBytes(uploadedBytes)} of ${formatBytes(
            item.file.size,
        )}`;
    }

    switch (item.status) {
        case 'pending':
            return 'Waiting...';
        case 'paused':
            return 'Paused';
        case 'queued':
            return 'Finalizing...';
        case 'processing':
            return 'Processing...';
        case 'completed':
            return 'Completed';
        case 'cancelled':
            return 'Cancelled';
        case 'failed':
            return item.error || 'Upload failed';
        default:
            return `${item.progress}%`;
    }
}

export default function UploadProgressPanel() {
    const { items, isPanelVisible, pause, resume, cancel, retry, closePanel, remove } =
        useUploadManager();
    const [isMinimized, setIsMinimized] = useState(false);
    const { props } = usePage() as any;
    const connections = props.auth?.user?.connections || [];

    if (!isPanelVisible || items.length === 0) {
        return null;
    }

    const activeCount = items.filter((item) =>
        ACTIVE_STATUSES.includes(item.status),
    ).length;
    const completedCount = items.filter(
        (item) => item.status === 'completed',
    ).length;
    const failedCount = items.filter((item) => item.status === 'failed').length;

    const totalProgress =
        items.length > 0
            ? Math.round(
                items.reduce((sum, item) => sum + item.progress, 0) /
                items.length,
            )
            : 0;

    const headerTitle =
        activeCount > 0
            ? `Uploading ${activeCount} file${activeCount === 1 ? '' : 's'}`
            : `Uploaded ${completedCount} file${completedCount === 1 ? '' : 's'
            }`;

    return (
        <div className="fixed right-6 bottom-6 z-50 w-95 overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 px-4 py-3">
                <div className="min-w-0">
                    <div className="truncate text-sm font-bold text-gray-900 dark:text-gray-100">
                        {headerTitle}
                    </div>
                    <div className="mt-0.5 text-[11px] font-semibold text-gray-500 dark:text-gray-400">
                        {completedCount} completed &middot; {activeCount} active
                        &middot; {failedCount} failed
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setIsMinimized(!isMinimized)}
                        aria-label={isMinimized ? 'Expand upload panel' : 'Minimize upload panel'}
                        className="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
                    >
                        {isMinimized ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={closePanel}
                        aria-label="Close upload panel"
                        className="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
                    >
                        <X className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            <div className="px-4 py-3">
                <div className="mb-1 flex items-center justify-between text-[11px] font-bold text-gray-500 dark:text-gray-400">
                    <span>Total progress</span>
                    <span>{totalProgress}%</span>
                </div>
                <Progress
                    value={totalProgress}
                    className="h-2 bg-gray-200 dark:bg-gray-800 [&>div]:bg-brand"
                />
            </div>

            {!isMinimized && (
                <div className="custom-scrollbar max-h-80 space-y-2 overflow-y-auto p-4 pt-0">
                {items.map((item) => {
                    const isFailed = item.status === 'failed';
                    const connection = connections.find((c: CloudConnection) => c.id === item.connectionId);

                    return (
                        <div
                            key={item.key}
                            className={`rounded-xl border p-3 ${isFailed
                                ? 'border-orange-200 dark:border-orange-900/50 bg-orange-50 dark:bg-orange-950/30'
                                : 'border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50'
                                }`}
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                        {connection?.provider_icon?.endsWith('.svg') ? (
                                            <img
                                                src={connection.provider_icon}
                                                className="h-4 w-4 shrink-0"
                                                alt={connection.provider}
                                            />
                                        ) : (
                                            <HardDrive className="h-4 w-4 shrink-0 text-gray-400 dark:text-gray-500" />
                                        )}
                                        <div className="truncate text-sm font-bold text-gray-900 dark:text-gray-100">
                                            {item.file?.name ??
                                                item.task?.name ??
                                                'File'}
                                        </div>
                                    </div>
                                    <div
                                        className={`mt-1 truncate text-xs font-semibold ${isFailed
                                            ? 'text-orange-600 dark:text-orange-400'
                                            : 'text-gray-500 dark:text-gray-400'
                                            }`}
                                    >
                                        {getStatusLabel(item)}
                                    </div>
                                </div>
                                <div className="flex items-center gap-1">
                                    {item.status === 'uploading' && (
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon-sm"
                                            onClick={() => void pause(item)}
                                            aria-label="Pause upload"
                                        >
                                            <Pause className="h-4 w-4" />
                                        </Button>
                                    )}
                                    {item.status === 'paused' && (
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon-sm"
                                            onClick={() => void resume(item)}
                                            aria-label="Resume upload"
                                        >
                                            <Play className="h-4 w-4" />
                                        </Button>
                                    )}
                                    {isFailed && (
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon-sm"
                                            onClick={() => retry(item)}
                                            aria-label="Retry upload"
                                        >
                                            <RotateCcw className="h-4 w-4" />
                                        </Button>
                                    )}
                                    {![
                                        'completed',
                                        'cancelled',
                                        'failed',
                                    ].includes(item.status) && (
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon-sm"
                                                onClick={() => void cancel(item)}
                                                aria-label="Cancel upload"
                                            >
                                                <X className="h-4 w-4" />
                                            </Button>
                                        )}
                                    {[
                                        'completed',
                                        'cancelled',
                                        'failed',
                                    ].includes(item.status) && (
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon-sm"
                                                onClick={() => remove(item)}
                                                aria-label="Remove upload"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        )}
                                </div>
                            </div>
                            <Progress
                                value={item.progress}
                                className={`mt-3 h-1.5 bg-gray-200 dark:bg-gray-800 ${isFailed
                                    ? '[&>div]:bg-orange-500'
                                    : '[&>div]:bg-brand'
                                    }`}
                            />
                        </div>
                    );
                })}
                </div>
            )}
        </div>
    );
}
