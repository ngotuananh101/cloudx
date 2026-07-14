import { Head, InfiniteScroll } from '@inertiajs/react';
import { AlertCircle } from 'lucide-react';
import {
    ActivityIcon,
    describeActivity,
} from '@/components/cloud/ActivityIcon';
import { Card, CardContent } from '@/components/ui/card';
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout';
import { formatRelativeTime } from '@/lib/utils';
import type { ActivityLogEntry } from '@/types/activity';

interface PaginatedLogs {
    data: ActivityLogEntry[];
}

interface ActivityLogsIndexProps {
    logs: PaginatedLogs;
    retentionDays: number;
}

export default function ActivityLogsIndex({
    logs,
    retentionDays,
}: Readonly<ActivityLogsIndexProps>) {
    return (
        <AuthenticatedLayout title="Activity Log">
            <Head title="Activity Log" />

            <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                <div>
                    <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-foreground">
                        Activity Log
                    </h2>
                    <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                        A history of actions you&apos;ve taken across your
                        connected storage over the last {retentionDays} days.
                    </p>
                </div>
            </div>

            {logs.data.length === 0 ? (
                <Card className="rounded-2xl border border-border bg-card shadow-sm">
                    <CardContent className="flex flex-col items-center justify-center px-6 py-16 text-center">
                        <AlertCircle className="mb-4 h-10 w-10 text-muted-foreground/50" />
                        <h3 className="text-lg font-bold text-foreground">
                            No activity yet
                        </h3>
                        <p className="mt-2 max-w-md text-sm text-muted-foreground">
                            Actions like uploads, moves, deletes and shares will
                            show up here once you start using your storage.
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <InfiniteScroll
                    data="logs"
                    itemsElement="#activity-log-list"
                    onlyNext
                >
                    <div id="activity-log-list" className="space-y-3">
                        {logs.data.map((log) => (
                            <div
                                key={log.id}
                                className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                                        <ActivityIcon icon={log.action.icon} />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-semibold text-foreground">
                                            {log.subject_name}
                                        </p>
                                        <p className="mt-0.5 truncate text-xs font-medium text-muted-foreground">
                                            {log.action.label}
                                            {describeActivity(log) && (
                                                <> {describeActivity(log)}</>
                                            )}
                                        </p>
                                    </div>
                                </div>
                                <span className="shrink-0 text-xs font-medium whitespace-nowrap text-muted-foreground">
                                    {formatRelativeTime(log.created_at)}
                                </span>
                            </div>
                        ))}
                    </div>
                </InfiniteScroll>
            )}
        </AuthenticatedLayout>
    );
}
