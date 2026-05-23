import { ChevronRight, FileCode, FileText, FolderArchive } from 'lucide-react';

const recentActivities = [
    {
        id: 1,
        fileName: 'Marketing_Assets_2024.zip',
        action: 'Uploaded to ',
        target: 'Google Drive',
        time: '2 mins ago',
        icon: FolderArchive,
        iconColor: 'text-blue-600 bg-blue-50',
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
        iconColor: 'text-green-600 bg-green-50',
    },
    {
        id: 3,
        fileName: 'Client_Contract_Final.pdf',
        action: 'Shared with ',
        target: 'sarah.j@company.com',
        time: '3 hours ago',
        icon: FileText,
        iconColor: 'text-purple-600 bg-purple-50',
    },
];

export default function RecentActivityList() {
    return (
        <div className="space-y-4 lg:col-span-2">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold tracking-tight text-gray-900">
                    Recent Activity
                </h3>
                <a href="#" className="flex items-center gap-0.5 text-xs font-bold text-brand hover:underline">
                    View History <ChevronRight className="h-3 w-3" />
                </a>
            </div>

            <div className="space-y-3">
                {recentActivities.map((activity) => (
                    <div
                        key={activity.id}
                        className="flex cursor-pointer items-center justify-between rounded-2xl border border-gray-100/50 bg-white p-5 shadow-sm transition-all duration-300 hover:border-gray-200/50 hover:shadow-md"
                    >
                        <div className="flex items-center gap-4">
                            <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${activity.iconColor}`}>
                                <activity.icon className="h-6 w-6" strokeWidth={2} />
                            </div>
                            <div>
                                <h4 className="text-sm font-bold text-gray-900">
                                    {activity.fileName}
                                </h4>
                                <p className="mt-1 text-xs text-gray-500">
                                    {activity.action}
                                    {activity.source && (
                                        <span className="font-bold text-gray-800">
                                            {activity.source}
                                        </span>
                                    )}
                                    {activity.middle}
                                    <span className="font-bold text-gray-800">
                                        {activity.target}
                                    </span>
                                    <span className="mx-1.5 text-gray-300">•</span>
                                    <span>{activity.time}</span>
                                </p>
                            </div>
                        </div>
                        <ChevronRight className="h-5 w-5 text-gray-300 group-hover:text-gray-400" />
                    </div>
                ))}
            </div>
        </div>
    );
}
