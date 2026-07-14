import { Link } from '@inertiajs/react';
import { ChevronRight } from 'lucide-react';
import {
    ActivityIcon,
    describeActivity,
} from '@/components/cloud/ActivityIcon';
import { formatRelativeTime } from '@/lib/utils';
import type { ActivityLogEntry } from '@/types/activity';

interface RecentActivityListProps {
    activities: ActivityLogEntry[];
}

export default function RecentActivityList({
    activities,
}: Readonly<RecentActivityListProps>) {
    return (
        <div className="space-y-4 lg:col-span-2">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold tracking-tight text-foreground">
                    Recent Activity
                </h3>
                <Link
                    href="/system/activity-logs"
                    className="flex items-center gap-0.5 text-xs font-bold text-primary hover:underline"
                >
                    View History <ChevronRight className="h-3 w-3" />
                </Link>
            </div>

            <div className="space-y-3">
                {activities.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                        No activity yet. Upload, move or share a file to see it
                        here.
                    </div>
                ) : (
                    activities.map((activity) => (
                        <div
                            key={activity.id}
                            className="group flex items-center justify-between rounded-2xl border border-border bg-card p-5 shadow-sm transition-all duration-300 hover:shadow-md"
                        >
                            <div className="flex items-center gap-4">
                                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                                    <ActivityIcon icon={activity.action.icon} />
                                </div>
                                <div className="min-w-0">
                                    <p className="truncate text-sm font-semibold text-foreground">
                                        {activity.subject_name}
                                    </p>
                                    <p className="mt-0.5 truncate text-xs font-medium text-muted-foreground">
                                        {activity.action.label}
                                        {describeActivity(activity) && (
                                            <> {describeActivity(activity)}</>
                                        )}
                                    </p>
                                </div>
                            </div>
                            <span className="shrink-0 text-xs font-medium whitespace-nowrap text-muted-foreground">
                                {formatRelativeTime(activity.created_at)}
                            </span>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
