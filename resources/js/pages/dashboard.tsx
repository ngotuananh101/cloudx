import { Head } from '@inertiajs/react';
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import {
    Cloud,
    FolderArchive,
    FileCode,
    FileText,
    TrendingUp,
    HardDrive,
    Database,
    ExternalLink,
    ChevronRight
} from 'lucide-react';

export default function Dashboard() {
    const storageData = [
        {
            provider: 'DRIVE',
            used: '128',
            total: '512GB',
            percent: 25,
            statusText: '25% Used',
            icon: HardDrive,
            color: 'bg-amber-500/10 text-amber-600',
        },
        {
            provider: 'ONEDRIVE',
            used: '842',
            total: '1024GB',
            percent: 82,
            statusText: '82% Used',
            icon: Cloud,
            color: 'bg-blue-500/10 text-blue-600',
        },
        {
            provider: 'AWS S3',
            used: '4.2',
            total: 'Unlimited',
            percent: 100, // represent active/full status bar
            statusText: 'Active',
            icon: Database,
            color: 'bg-orange-500/10 text-orange-600',
        },
        {
            provider: 'DROPBOX',
            used: '12',
            total: '20GB',
            percent: 60,
            statusText: '60% Used',
            icon: HardDrive,
            color: 'bg-indigo-500/10 text-indigo-600',
        },
    ];

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

    return (
        <AuthenticatedLayout title="Workspace">
            <Head title="Dashboard" />

            {/* Health & Header */}
            <div className="mb-4 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                    <span className="text-[10px] font-extrabold tracking-widest text-gray-400">SYSTEM HEALTH</span>
                    <h2 className="text-2xl font-extrabold tracking-tight text-gray-900 mt-1">Storage Overview</h2>
                </div>
                <div className="flex items-center gap-2 self-start rounded-full bg-emerald-50 px-4 py-1.5 text-xs font-semibold text-emerald-700 border border-emerald-100 sm:self-center shadow-sm">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    All systems operational
                </div>
            </div>

            {/* Storage Cards Grid */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {storageData.map((storage) => (
                    <Card
                        key={storage.provider}
                        className="group relative overflow-hidden rounded-2xl border border-gray-100/50 ring-0 bg-white p-6 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1"
                    >
                        <CardContent className="p-0">
                            {/* Card Header */}
                            <div className="flex items-center justify-between mb-4">
                                <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${storage.color}`}>
                                    <storage.icon className="h-6 w-6" strokeWidth={2} />
                                </div>
                                <span className="text-[10px] font-black tracking-widest text-gray-400">
                                    {storage.provider}
                                </span>
                            </div>

                            {/* Storage Value */}
                            <div className="mb-3 flex justify-between">
                                <div className="flex items-baseline gap-1">
                                    <span className="text-2xl font-extrabold text-gray-900 tracking-tight">{storage.used}</span>
                                    <span className="text-sm font-semibold text-gray-400">/{storage.total}</span>
                                </div>
                                <span className="text-xs font-bold text-brand mt-1 block">
                                    {storage.statusText}
                                </span>
                            </div>

                            {/* Progress bar */}
                            <div className="relative pt-1">
                                <Progress
                                    value={storage.percent}
                                    className="h-2 bg-gray-100 [&>div]:bg-brand"
                                />
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Main Content Sections */}
            <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-3">
                {/* Left: Recent Activity */}
                <div className="lg:col-span-2 space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-bold tracking-tight text-gray-900">Recent Activity</h3>
                        <a href="#" className="text-xs font-bold text-brand hover:underline flex items-center gap-0.5">
                            View History <ChevronRight className="h-3 w-3" />
                        </a>
                    </div>

                    <div className="space-y-3">
                        {recentActivities.map((activity) => (
                            <div
                                key={activity.id}
                                className="flex items-center justify-between rounded-2xl border border-gray-100/50 bg-white p-5 shadow-sm hover:shadow-md transition-all duration-300 hover:border-gray-200/50 cursor-pointer"
                            >
                                <div className="flex items-center gap-4">
                                    {/* Icon Container */}
                                    <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${activity.iconColor}`}>
                                        <activity.icon className="h-6 w-6" strokeWidth={2} />
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-bold text-gray-900">{activity.fileName}</h4>
                                        <p className="text-xs text-gray-500 mt-1">
                                            {activity.action}
                                            {activity.source && (
                                                <span className="font-bold text-gray-800">{activity.source}</span>
                                            )}
                                            {activity.middle}
                                            <span className="font-bold text-gray-800">{activity.target}</span>
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

                {/* Right: Summary Widgets */}
                <div className="space-y-6 lg:col-span-1">
                    {/* Cloud Hub Connection widget */}
                    <Card className="rounded-2xl border border-gray-100/50 ring-0 bg-white p-6 shadow-sm">
                        <CardContent className="p-0">
                            <h4 className="text-lg font-black text-gray-900 tracking-tight">Cloud Hub</h4>
                            <p className="mt-2 text-xs font-medium text-gray-500 leading-relaxed">
                                Centralize your data. Connect another provider to manage all files from one dashboard.
                            </p>

                            {/* Mini provider icons */}
                            <div className="my-6 grid grid-cols-3 gap-3">
                                {['DRIVE', 'AZURE', 'AWS'].map((item) => (
                                    <div key={item} className="flex flex-col items-center justify-center rounded-xl bg-gray-50 py-3 text-center border border-gray-100/50 hover:bg-gray-100/80 transition-colors">
                                        <Cloud className="h-5 w-5 text-gray-400" />
                                        <span className="mt-1 text-[8px] font-black tracking-wider text-gray-500">{item}</span>
                                    </div>
                                ))}
                            </div>

                            {/* Action Button */}
                            <Button className="h-11 w-full rounded-xl bg-[#0f172a] font-bold text-xs tracking-wider text-white hover:bg-[#1e293b] shadow-sm transition-all duration-300">
                                Connect Storage
                            </Button>
                        </CardContent>
                    </Card>

                    {/* Total Usage widget */}
                    <div className="relative overflow-hidden rounded-2xl bg-[#bd1e24] p-6 text-white shadow-lg hover:shadow-xl transition-all duration-300 group">
                        {/* Background subtle elements */}
                        <div className="absolute -right-6 -top-6 h-28 w-28 rounded-full bg-white/5 group-hover:scale-110 transition-transform duration-500" />
                        <div className="absolute -right-3 -top-3 flex h-16 w-16 items-center justify-center rounded-full border border-white/25 bg-white/10 shadow-sm backdrop-blur-sm">
                            <TrendingUp className="h-6 w-6 text-white" strokeWidth={2.5} />
                        </div>

                        <div>
                            <span className="text-[10px] font-black tracking-widest text-white/70">TOTAL USAGE</span>
                            <h4 className="mt-2 text-4xl font-black tracking-tight">1.2 TB</h4>

                            <p className="mt-4 text-xs font-medium text-white/80 leading-relaxed">
                                You've increased your cloud storage usage by <span className="font-bold text-white">12%</span> this month. Upgrade for more bandwidth.
                            </p>

                            <a
                                href="#"
                                className="mt-6 inline-flex items-center gap-1 text-xs font-extrabold tracking-wide hover:underline"
                            >
                                Manage Billing <ChevronRight className="h-3 w-3" />
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
