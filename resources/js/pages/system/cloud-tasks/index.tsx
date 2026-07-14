import { Head, InfiniteScroll, usePage } from '@inertiajs/react';
import {
    AlertCircle,
    CheckCircle2,
    Clock,
    Eye,
    Loader2,
    XCircle,
    HardDrive,
} from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout';
import type { CloudConnection } from '@/types/cloud';

interface CloudTaskEnumValue {
    value: number | string | null;
    key: string | null;
    label: string | null;
}

interface CloudTaskConnection {
    id: number;
    name: string;
}

interface CloudTask {
    id: number;
    name: string;
    target_path: string | null;
    type: CloudTaskEnumValue;
    status: CloudTaskEnumValue;
    connection: CloudTaskConnection | null;
    error_message: string | null;
    created_at: string | null;
    updated_at: string | null;
    queued_at: string | null;
    processing_at: string | null;
    completed_at: string | null;
    failed_at: string | null;
    cancelled_at: string | null;
}

interface PaginatedTasks {
    data: CloudTask[];
}

interface CloudTasksIndexProps {
    tasks: PaginatedTasks;
}

function formatDate(value: string | null): string {
    if (!value) {
        return '—';
    }

    return new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(new Date(value));
}

function statusClass(statusKey: string | null): string {
    switch (statusKey) {
        case 'Completed':
            return 'border-primary/30 bg-primary/10 text-primary';
        case 'Failed':
        case 'Cancelled':
            return 'border-destructive/30 bg-destructive/10 text-destructive';
        case 'Processing':
        case 'Uploading':
            return 'border-primary/30 bg-primary/10 text-primary';
        default:
            return 'border-border bg-muted text-muted-foreground';
    }
}

function StatusIcon({ statusKey }: Readonly<{ statusKey: string | null }>) {
    switch (statusKey) {
        case 'Completed':
            return <CheckCircle2 className="h-4 w-4" />;
        case 'Failed':
        case 'Cancelled':
            return <XCircle className="h-4 w-4" />;
        case 'Processing':
        case 'Uploading':
            return <Loader2 className="h-4 w-4 animate-spin" />;
        default:
            return <Clock className="h-4 w-4" />;
    }
}

function TaskStatusBadge({ task }: Readonly<{ task: CloudTask }>) {
    return (
        <span
            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium ${statusClass(task.status.key)}`}
        >
            <StatusIcon statusKey={task.status.key} />
            {task.status.label ?? 'Unknown'}
        </span>
    );
}

function TaskDetailModal({
    task,
    onClose,
}: Readonly<{
    task: CloudTask | null;
    onClose: () => void;
}>) {
    const timeline = task
        ? [
              ['Created', task.created_at],
              ['Updated', task.updated_at],
              ['Queued', task.queued_at],
              ['Processing', task.processing_at],
              ['Completed', task.completed_at],
              ['Failed', task.failed_at],
              ['Cancelled', task.cancelled_at],
          ]
        : [];

    return (
        <Dialog
            open={task !== null}
            onOpenChange={(open) => !open && onClose()}
        >
            <DialogContent className="max-h-[90vh] overflow-hidden rounded-xl border border-border bg-card p-0 shadow-2xl sm:max-w-2xl [&>button]:top-5 [&>button]:right-6 [&>button]:z-10">
                {task && (
                    <>
                        <DialogHeader className="border-b border-border px-6 py-5 text-left">
                            <DialogDescription className="text-[10px] font-extrabold tracking-widest text-muted-foreground uppercase">
                                Task Details
                            </DialogDescription>
                            <DialogTitle className="mt-1 truncate text-base font-semibold tracking-tight text-foreground">
                                {task.name}
                            </DialogTitle>
                        </DialogHeader>

                        <div className="max-h-[calc(90vh-82px)] overflow-y-auto px-6 py-5">
                            <div className="mb-5 flex flex-wrap items-center gap-2">
                                <TaskStatusBadge task={task} />
                                <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                                    {task.type.label ?? 'Unknown'}
                                </span>
                            </div>

                            <div className="grid gap-4 sm:grid-cols-2">
                                <DetailItem label="Connection">
                                    {task.connection?.name ?? 'Unavailable'}
                                </DetailItem>
                                <DetailItem label="Target path">
                                    {task.target_path || '/'}
                                </DetailItem>
                            </div>

                            {task.error_message && (
                                <div className="mt-5 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
                                    {task.error_message}
                                </div>
                            )}

                            <div className="mt-6">
                                <h4 className="text-xs font-extrabold tracking-widest text-muted-foreground">
                                    TIMELINE
                                </h4>
                                <div className="mt-3 overflow-hidden rounded-xl border border-border">
                                    {timeline.map(([label, value]) => (
                                        <div
                                            key={label}
                                            className="flex items-center justify-between gap-4 border-b border-border px-4 py-3 text-xs last:border-b-0"
                                        >
                                            <span className="font-medium text-muted-foreground">
                                                {label}
                                            </span>
                                            <span className="text-right font-medium text-foreground">
                                                {formatDate(value)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}

function DetailItem({
    label,
    children,
}: Readonly<{
    label: string;
    children: ReactNode;
}>) {
    return (
        <div className="rounded-xl border border-border bg-muted px-4 py-3">
            <div className="text-[10px] font-extrabold tracking-widest text-muted-foreground">
                {label}
            </div>
            <div className="mt-1 text-sm font-medium wrap-break-word text-foreground">
                {children}
            </div>
        </div>
    );
}

export default function CloudTasksIndex({ tasks }: Readonly<CloudTasksIndexProps>) {
    const { props } = usePage() as any;
    const userConnections = props.auth?.user?.connections || [];
    const [selectedTask, setSelectedTask] = useState<CloudTask | null>(null);

    return (
        <AuthenticatedLayout title="Tasks">
            <Head title="System Tasks" />

            <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                <div>
                    <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-foreground">
                        Tasks
                    </h2>
                    <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                        Review your cloud task history, including upload
                        progress, completion status, and failures.
                    </p>
                </div>
            </div>

            {tasks.data.length === 0 ? (
                <Card className="rounded-2xl border border-border bg-card shadow-sm">
                    <CardContent className="flex flex-col items-center justify-center px-6 py-16 text-center">
                        <AlertCircle className="mb-4 h-10 w-10 text-muted-foreground/50" />
                        <h3 className="text-lg font-bold text-foreground">
                            No tasks yet
                        </h3>
                        <p className="mt-2 max-w-md text-sm text-muted-foreground">
                            Cloud tasks will appear here after you start uploads
                            or other background file operations.
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <Card className="rounded-xl border border-border bg-card py-0 shadow-sm">
                    <CardContent className="p-0">
                        <InfiniteScroll
                            data="tasks"
                            itemsElement="#cloud-tasks-table-body"
                            onlyNext
                        >
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-215 text-left text-sm">
                                    <thead>
                                        <tr className="border-b border-border bg-muted/50 text-[11px] font-extrabold tracking-wider text-muted-foreground">
                                            <th className="px-5 py-3">Task</th>
                                            <th className="px-5 py-3">Type</th>
                                            <th className="px-5 py-3">
                                                Status
                                            </th>
                                            <th className="px-5 py-3">
                                                Connection
                                            </th>
                                            <th className="px-5 py-3">
                                                Created
                                            </th>
                                            <th className="px-5 py-3 text-right">
                                                Action
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody id="cloud-tasks-table-body">
                                        {tasks.data.map((task) => {
                                            const fullConnection =
                                                userConnections.find(
                                                    (c: Readonly<CloudConnection>) =>
                                                        c.id ===
                                                        task.connection?.id,
                                                );

                                            return (
                                                <tr
                                                    key={task.id}
                                                    className="border-b border-border last:border-b-0 hover:bg-muted/70"
                                                >
                                                    <td className="max-w-[18rem] px-5 py-4">
                                                        <div className="truncate text-sm font-medium text-foreground">
                                                            {task.name}
                                                        </div>
                                                        <div className="mt-1 truncate text-xs font-medium text-muted-foreground">
                                                            {task.target_path ||
                                                                '/'}
                                                        </div>
                                                    </td>
                                                    <td className="px-5 py-4 text-xs font-medium text-muted-foreground">
                                                        {task.type.label ??
                                                            'Unknown'}
                                                    </td>
                                                    <td className="px-5 py-4">
                                                        <TaskStatusBadge
                                                            task={task}
                                                        />
                                                    </td>
                                                    <td className="max-w-56 px-5 py-4">
                                                        <div className="flex items-center gap-2">
                                                            {fullConnection?.provider_icon?.endsWith(
                                                                '.svg',
                                                            ) ? (
                                                                <img
                                                                    src={
                                                                        fullConnection.provider_icon
                                                                    }
                                                                    className="h-4 w-4 shrink-0"
                                                                    alt={
                                                                        fullConnection.provider
                                                                    }
                                                                />
                                                            ) : (
                                                                <HardDrive className="h-4 w-4 shrink-0 text-muted-foreground" />
                                                            )}
                                                            <div className="truncate text-xs font-medium text-muted-foreground">
                                                                {task.connection
                                                                    ?.name ??
                                                                    'Unavailable'}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-5 py-4 text-xs font-medium whitespace-nowrap text-muted-foreground">
                                                        {formatDate(
                                                            task.created_at,
                                                        )}
                                                    </td>
                                                    <td className="px-5 py-4 text-right">
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() =>
                                                                setSelectedTask(
                                                                    task,
                                                                )
                                                            }
                                                            className="h-8 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground"
                                                        >
                                                            <Eye className="h-4 w-4" />
                                                            Details
                                                        </Button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </InfiniteScroll>
                    </CardContent>
                </Card>
            )}

            <TaskDetailModal
                task={selectedTask}
                onClose={() => setSelectedTask(null)}
            />
        </AuthenticatedLayout>
    );
}
