import { ChevronRight, FileCode, FileText, FolderArchive } from 'lucide-react';

const recentActivities = [
    {
        id: 1,
        fileName: 'Marketing_Assets_2024.zip',
        action: 'Uploaded to ',
        target: 'Google Drive',
        time: '2 mins ago',
        icon: FolderArchive,
        iconColor: 'text-primary bg-primary/10',
    },
    {
        id: 2,
        fileName: 'Design_Specs_v2.fig',
        action: 'Moved from ',
        source: 'AWS',
        middle: ' to ',
        target: 'Dropbox',
        time: '1 hour ago',
        icon: FileCode,
        iconColor: 'text-primary bg-primary/10',
    },
    {
        id: 3,
        fileName: 'Client_Contract_Final.pdf',
        action: 'Shared with ',
        target: 'sarah.j@company.com',
        time: '3 hours ago',
        icon: FileText,
        iconColor: 'text-primary bg-primary/10',
    },
];

export default function RecentActivityList() {
    return (
        <div className="space-y-4 lg:col-span-2">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold tracking-tight text-foreground">
                    Recent Activity
                </h3>
                <a
                    href="#"
                    className="flex items-center gap-0.5 text-xs font-bold text-primary hover:underline"
                >
                    View History <ChevronRight className="h-3 w-3" />
                </a>
            </div>

            <div className="space-y-3">
                {recentActivities.map((activity) => (
                    <div
                        key={activity.id}
                        className="group flex cursor-pointer items-center justify-between rounded-2xl border border-border bg-card p-5 shadow-sm transition-all duration-300 hover:shadow-md"
                    >
                        <div className="flex items-center gap-4">
                            <div
                                className={`flex h-12 w-12 items-center justify-center rounded-xl ${activity.iconColor}`}
                            >
                                <activity.icon
                                    className="h-6 w-6"
                                    strokeWidth={2}
                                />
                            </div>
                            <div>
                                <h4 className="text-sm font-bold text-foreground">
                                    {activity.fileName}
                                </h4>
                                <p className="mt-1 text-xs text-muted-foreground">
                                    {activity.action}
                                    {activity.source && (
                                        <span className="font-bold text-foreground">
                                            {activity.source}
                                        </span>
                                    )}
                                    {activity.middle}
                                    <span className="font-bold text-foreground">
                                        {activity.target}
                                    </span>
                                    <span className="mx-1.5 text-muted-foreground/50">
                                        •
                                    </span>
                                    <span>{activity.time}</span>
                                </p>
                            </div>
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted-foreground/50 group-hover:text-muted-foreground" />
                    </div>
                ))}
            </div>
        </div>
    );
}
