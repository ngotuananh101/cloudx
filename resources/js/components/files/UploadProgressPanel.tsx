import { usePage } from '@inertiajs/react';
import {
    Pause,
    Play,
    RotateCcw,
    X,
    ChevronDown,
    ChevronUp,
    Trash2,
    HardDrive,
} from 'lucide-react';
import { useState } from 'react';
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
            if (item.source === 'remote') {
                return 'Downloading remotely...';
            }

            return 'Finalizing...';
        case 'processing':
            if (item.source === 'remote') {
                return 'Importing remote file...';
            }

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
    const {
        items,
        isPanelVisible,
        pause,
        resume,
        cancel,
        retry,
        closePanel,
        remove,
    } = useUploadManager();
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

    const activeSuffix = activeCount === 1 ? '' : 's';
    const completedSuffix = completedCount === 1 ? '' : 's';
    const headerTitle =
        activeCount > 0
            ? `Uploading ${activeCount} file${activeSuffix}`
            : `Uploaded ${completedCount} file${completedSuffix}`;

    return (
        <div className="fixed right-6 bottom-6 z-50 w-95 overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-border bg-muted px-4 py-3">
                <div className="min-w-0">
                    <div className="truncate text-sm font-bold text-foreground">
                        {headerTitle}
                    </div>
                    <div className="mt-0.5 text-[11px] font-semibold text-muted-foreground">
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
                        aria-label={
                            isMinimized
                                ? 'Expand upload panel'
                                : 'Minimize upload panel'
                        }
                        className="text-muted-foreground hover:text-foreground"
                    >
                        {isMinimized ? (
                            <ChevronUp className="h-4 w-4" />
                        ) : (
                            <ChevronDown className="h-4 w-4" />
                        )}
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={closePanel}
                        aria-label="Close upload panel"
                        className="text-muted-foreground hover:text-foreground"
                    >
                        <X className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            <div className="px-4 py-3">
                <div className="mb-1 flex items-center justify-between text-[11px] font-bold text-muted-foreground">
                    <span>Total progress</span>
                    <span>{totalProgress}%</span>
                </div>
                <Progress
                    value={totalProgress}
                    className="h-2 bg-muted [&>div]:bg-primary"
                />
            </div>

            {!isMinimized && (
                <div className="custom-scrollbar max-h-80 space-y-2 overflow-y-auto p-4 pt-0">
                    {items.map((item) => {
                        const isFailed = item.status === 'failed';
                        const connection = connections.find(
                            (c: CloudConnection) => c.id === item.connectionId,
                        );

                        return (
                            <div
                                key={item.key}
                                className={`rounded-xl border p-3 ${
                                    isFailed
                                        ? 'border-border bg-muted'
                                        : 'border-border bg-muted/50'
                                }`}
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                            {connection?.provider_icon?.endsWith(
                                                '.svg',
                                            ) ? (
                                                <img
                                                    src={
                                                        connection.provider_icon
                                                    }
                                                    className="h-4 w-4 shrink-0"
                                                    alt={connection.provider}
                                                />
                                            ) : (
                                                <HardDrive className="h-4 w-4 shrink-0 text-muted-foreground" />
                                            )}
                                            <div className="truncate text-sm font-bold text-foreground">
                                                {item.file?.name ??
                                                    item.task?.name ??
                                                    item.remote?.filename ??
                                                    item.remote?.url ??
                                                    'File'}
                                            </div>
                                        </div>
                                        <div className="mt-1 truncate text-xs font-semibold text-muted-foreground">
                                            {getStatusLabel(item)}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        {item.status === 'uploading' && (
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon-sm"
                                                onClick={() => {
                                                    pause(item);
                                                }}
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
                                                onClick={() => {
                                                    resume(item);
                                                }}
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
                                                onClick={() => {
                                                    cancel(item);
                                                }}
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
                                    className={`mt-3 h-1.5 bg-muted ${
                                        isFailed
                                            ? '[&>div]:bg-muted-foreground'
                                            : '[&>div]:bg-primary'
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
