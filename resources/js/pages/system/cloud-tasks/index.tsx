import { Head, InfiniteScroll } from '@inertiajs/react';
import {
    AlertCircle,
    CheckCircle2,
    Clock,
    Eye,
    Loader2,
    X,
    XCircle,
} from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

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
            return 'border-emerald-100 bg-emerald-50 text-emerald-700';
        case 'Failed':
        case 'Cancelled':
            return 'border-red-100 bg-red-50 text-red-700';
        case 'Processing':
        case 'Uploading':
            return 'border-blue-100 bg-blue-50 text-blue-700';
        default:
            return 'border-gray-100 bg-gray-50 text-gray-700';
    }
}

function StatusIcon({ statusKey }: { statusKey: string | null }) {
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

function TaskStatusBadge({ task }: { task: CloudTask }) {
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
}: {
    task: CloudTask | null;
    onClose: () => void;
}) {
    if (!task) {
        return null;
    }

    const timeline = [
        ['Created', task.created_at],
        ['Updated', task.updated_at],
        ['Queued', task.queued_at],
        ['Processing', task.processing_at],
        ['Completed', task.completed_at],
        ['Failed', task.failed_at],
        ['Cancelled', task.cancelled_at],
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 px-4">
            <div className="max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-xl border border-gray-100 bg-white shadow-2xl">
                <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-6 py-5">
                    <div className="min-w-0">
                        <span className="text-[10px] font-extrabold tracking-widest text-gray-400">
                            TASK DETAILS
                        </span>
                        <h3 className="mt-1 truncate text-base font-semibold tracking-tight text-gray-900">
                            {task.name}
                        </h3>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-full p-2 text-gray-400 transition-colors hover:bg-gray-50 hover:text-gray-900"
                        aria-label="Close task details"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="max-h-[calc(90vh-82px)] overflow-y-auto px-6 py-5">
                    <div className="mb-5 flex flex-wrap items-center gap-2">
                        <TaskStatusBadge task={task} />
                        <span className="rounded-full bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-600">
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
                        <div className="mt-5 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                            {task.error_message}
                        </div>
                    )}

                    <div className="mt-6">
                        <h4 className="text-xs font-extrabold tracking-widest text-gray-400">
                            TIMELINE
                        </h4>
                        <div className="mt-3 overflow-hidden rounded-xl border border-gray-100">
                            {timeline.map(([label, value]) => (
                                <div
                                    key={label}
                                    className="flex items-center justify-between gap-4 border-b border-gray-100 px-4 py-3 text-xs last:border-b-0"
                                >
                                    <span className="font-medium text-gray-500">
                                        {label}
                                    </span>
                                    <span className="text-right font-medium text-gray-900">
                                        {formatDate(value)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function DetailItem({
    label,
    children,
}: {
    label: string;
    children: ReactNode;
}) {
    return (
        <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
            <div className="text-[10px] font-extrabold tracking-widest text-gray-400">
                {label}
            </div>
            <div className="mt-1 break-words text-sm font-medium text-gray-900">
                {children}
            </div>
        </div>
    );
}

export default function CloudTasksIndex({ tasks }: CloudTasksIndexProps) {
    const [selectedTask, setSelectedTask] = useState<CloudTask | null>(null);

    return (
        <AuthenticatedLayout title="Tasks">
            <Head title="System Tasks" />

            <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                <div>
                    <span className="text-[10px] font-extrabold tracking-widest text-gray-400">
                        SYSTEM
                    </span>
                    <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-gray-900">
                        Tasks
                    </h2>
                    <p className="mt-2 max-w-2xl text-sm text-gray-500">
                        Review your cloud task history, including upload progress,
                        completion status, and failures.
                    </p>
                </div>
            </div>

            {tasks.data.length === 0 ? (
                <Card className="rounded-2xl border border-gray-100 bg-white shadow-sm">
                    <CardContent className="flex flex-col items-center justify-center px-6 py-16 text-center">
                        <AlertCircle className="mb-4 h-10 w-10 text-gray-300" />
                        <h3 className="text-lg font-bold text-gray-900">
                            No tasks yet
                        </h3>
                        <p className="mt-2 max-w-md text-sm text-gray-500">
                            Cloud tasks will appear here after you start uploads or
                            other background file operations.
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <Card className="rounded-xl border border-gray-100 bg-white py-0 shadow-sm">
                    <CardContent className="p-0">
                        <InfiniteScroll
                            data="tasks"
                            itemsElement="#cloud-tasks-table-body"
                            onlyNext
                        >
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[860px] text-left text-sm">
                                    <thead>
                                        <tr className="border-b border-gray-100 bg-gray-50/50 text-[11px] font-extrabold tracking-wider text-gray-400">
                                            <th className="px-5 py-3">Task</th>
                                            <th className="px-5 py-3">Type</th>
                                            <th className="px-5 py-3">Status</th>
                                            <th className="px-5 py-3">
                                                Connection
                                            </th>
                                            <th className="px-5 py-3">Created</th>
                                            <th className="px-5 py-3 text-right">
                                                Action
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody id="cloud-tasks-table-body">
                                        {tasks.data.map((task) => (
                                            <tr
                                                key={task.id}
                                                className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50/70"
                                            >
                                                <td className="max-w-[18rem] px-5 py-4">
                                                    <div className="truncate text-sm font-medium text-gray-900">
                                                        {task.name}
                                                    </div>
                                                    <div className="mt-1 truncate text-xs font-medium text-gray-400">
                                                        {task.target_path || '/'}
                                                    </div>
                                                </td>
                                                <td className="px-5 py-4 text-xs font-medium text-gray-500">
                                                    {task.type.label ??
                                                        'Unknown'}
                                                </td>
                                                <td className="px-5 py-4">
                                                    <TaskStatusBadge task={task} />
                                                </td>
                                                <td className="max-w-[14rem] px-5 py-4">
                                                    <div className="truncate text-xs font-medium text-gray-500">
                                                        {task.connection?.name ??
                                                            'Unavailable'}
                                                    </div>
                                                </td>
                                                <td className="px-5 py-4 text-xs font-medium whitespace-nowrap text-gray-500">
                                                    {formatDate(task.created_at)}
                                                </td>
                                                <td className="px-5 py-4 text-right">
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() =>
                                                            setSelectedTask(task)
                                                        }
                                                        className="h-8 rounded-lg text-xs font-medium text-gray-500 hover:text-gray-900"
                                                    >
                                                        <Eye className="h-4 w-4" />
                                                        Details
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))}
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
