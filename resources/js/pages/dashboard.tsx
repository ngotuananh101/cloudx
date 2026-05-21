import { Head, router } from '@inertiajs/react';
import {
    Cloud,
    FolderArchive,
    FileCode,
    FileText,
    TrendingUp,
    HardDrive,
    Database,
    ChevronRight,
    CloudOff,
    Trash2,
    X,
    Lock,
} from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout';
import { destroy as destroyConnection } from '@/routes/cloud-connections';
import { redirect as googleRedirect } from '@/routes/oauth/google';

interface Connection {
    id: number;
    name: string;
    provider: string;
    provider_value: number;
    provider_icon: string;
    status: string;
    status_value: number;
    used_space: number;
    total_space: number;
    used_formatted: string;
    total_formatted: string;
    percent: number;
}

interface DashboardProps {
    connections: Connection[];
}

export default function Dashboard({ connections = [] }: DashboardProps) {
    const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);

    const handleDisconnect = (id: number, name: string) => {
        if (confirm(`Are you sure you want to disconnect ${name}?`)) {
            router.delete(destroyConnection.url(id));
        }
    };

    const handleConnectGoogle = () => {
        setIsConnectModalOpen(false);
        window.location.href = googleRedirect.url();
    };

    // Calculate total statistics
    const totalUsedBytes = connections.reduce(
        (acc, c) => acc + (c.used_space || 0),
        0,
    );

    const formatBytes = (bytes: number, precision = 1) => {
        if (bytes <= 0) {
            return '0 B';
        }

        const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
        const pow = Math.floor(Math.log(bytes) / Math.log(1024));
        const unitLimit = Math.min(pow, units.length - 1);

        return (
            (bytes / Math.pow(1024, unitLimit)).toFixed(precision) +
            ' ' +
            units[unitLimit]
        );
    };

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
                    <span className="text-[10px] font-extrabold tracking-widest text-gray-400">
                        SYSTEM HEALTH
                    </span>
                    <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-gray-900">
                        Storage Overview
                    </h2>
                </div>
                <div className="flex items-center gap-2 self-start rounded-full border border-emerald-100 bg-emerald-50 px-4 py-1.5 text-xs font-semibold text-emerald-700 shadow-sm sm:self-center">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
                    All systems operational
                </div>
            </div>

            {/* Storage Cards Grid / Empty State */}
            {connections.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-3xl border border-gray-200/60 bg-white p-12 text-center shadow-sm">
                    <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-gray-100 bg-gray-50 text-gray-400">
                        <CloudOff
                            className="h-8 w-8 text-gray-400"
                            strokeWidth={1.5}
                        />
                    </div>
                    <h3 className="text-lg font-extrabold tracking-tight text-gray-900">
                        No Connected Storages
                    </h3>
                    <p className="mt-2 max-w-sm text-sm leading-relaxed font-medium text-gray-500">
                        Connect your cloud storage providers to start
                        centralizing and managing your files safely within one
                        unified dashboard.
                    </p>
                    <div className="mt-6">
                        <Button
                            onClick={() => setIsConnectModalOpen(true)}
                            className="h-11 rounded-xl bg-[#0f172a] px-6 text-xs font-bold tracking-wider text-white shadow-sm transition-all duration-300 hover:bg-[#1e293b]"
                        >
                            Connect Your First Storage
                        </Button>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {connections.map((connection) => {
                        let colorClass = 'bg-amber-500/10 text-amber-600';

                        if (connection.provider_value === 1) {
                            // Google Drive
                            colorClass = 'bg-blue-500/10 text-blue-600';
                        } else if (connection.provider_value === 2) {
                            // OneDrive
                            colorClass = 'bg-indigo-500/10 text-indigo-600';
                        } else if (connection.provider_value === 3) {
                            // Dropbox
                            colorClass = 'bg-blue-500/10 text-blue-600';
                        } else if (connection.provider_value === 4) {
                            // AWS S3
                            colorClass = 'bg-orange-500/10 text-orange-600';
                        }

                        return (
                            <Card
                                key={connection.id}
                                className="group relative overflow-hidden rounded-2xl border border-gray-100/50 bg-white p-6 shadow-sm ring-0 transition-all duration-300 hover:-translate-y-1 hover:shadow-md"
                            >
                                <CardContent className="p-0">
                                    <div className="mb-4 flex items-center justify-between">
                                        <div
                                            className={`flex h-11 w-11 items-center justify-center rounded-xl ${colorClass}`}
                                        >
                                            {connection.provider_icon?.endsWith(
                                                '.svg',
                                            ) ? (
                                                <img
                                                    src={
                                                        connection.provider_icon
                                                    }
                                                    className="h-6 w-6"
                                                    alt={connection.provider}
                                                />
                                            ) : (
                                                <HardDrive
                                                    className="h-6 w-6"
                                                    strokeWidth={2}
                                                />
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-black tracking-widest text-gray-400">
                                                {connection.provider.toUpperCase()}
                                            </span>
                                            <button
                                                onClick={() =>
                                                    handleDisconnect(
                                                        connection.id,
                                                        connection.name,
                                                    )
                                                }
                                                className="rounded-lg p-1.5 text-gray-400 opacity-0 transition-all group-hover:opacity-100 hover:bg-red-50 hover:text-red-600"
                                                title="Disconnect Storage"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="mb-3 flex items-baseline justify-between">
                                        <div className="flex items-baseline gap-1">
                                            <span className="text-2xl font-extrabold tracking-tight text-gray-900">
                                                {connection.used_formatted}
                                            </span>
                                            <span className="text-xs font-semibold text-gray-400">
                                                /{connection.total_formatted}
                                            </span>
                                        </div>
                                        <span className="rounded-full bg-red-50/50 px-2 py-0.5 text-[10px] font-extrabold text-brand">
                                            {connection.percent}% Used
                                        </span>
                                    </div>

                                    <div className="relative pt-1">
                                        <Progress
                                            value={connection.percent}
                                            className="h-2 bg-gray-100 [&>div]:bg-brand"
                                        />
                                    </div>

                                    <div className="mt-3 truncate text-[10px] font-bold text-gray-500">
                                        {connection.name}
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}

            {/* Main Content Sections */}
            <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-3">
                {/* Left: Recent Activity */}
                <div className="space-y-4 lg:col-span-2">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-bold tracking-tight text-gray-900">
                            Recent Activity
                        </h3>
                        <a
                            href="#"
                            className="flex items-center gap-0.5 text-xs font-bold text-brand hover:underline"
                        >
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
                                    <div
                                        className={`flex h-12 w-12 items-center justify-center rounded-xl ${activity.iconColor}`}
                                    >
                                        <activity.icon
                                            className="h-6 w-6"
                                            strokeWidth={2}
                                        />
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
                                            <span className="mx-1.5 text-gray-300">
                                                •
                                            </span>
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
                    <Card className="rounded-2xl border border-gray-100/50 bg-white p-6 shadow-sm ring-0">
                        <CardContent className="p-0">
                            <h4 className="text-lg font-black tracking-tight text-gray-900">
                                Cloud Hub
                            </h4>
                            <p className="mt-2 text-xs leading-relaxed font-medium text-gray-500">
                                Centralize your data. Connect another provider
                                to manage all files from one dashboard.
                            </p>

                            {/* Mini provider icons */}
                            <div className="my-6 grid grid-cols-3 gap-3">
                                {['GOOGLE', 'ONEDRIVE', 'AWS S3'].map(
                                    (item) => {
                                        let miniIcon = (
                                            <Cloud className="h-5 w-5 text-gray-400" />
                                        );

                                        if (item === 'GOOGLE') {
                                            miniIcon = (
                                                <img
                                                    src="/assets/svg/GoogleDrive.svg"
                                                    className="h-5 w-5"
                                                    alt="Google Drive"
                                                />
                                            );
                                        } else if (item === 'AWS S3') {
                                            miniIcon = (
                                                <Database className="h-5 w-5 text-gray-400" />
                                            );
                                        }

                                        return (
                                            <div
                                                key={item}
                                                className="flex flex-col items-center justify-center rounded-xl border border-gray-100/50 bg-gray-50 py-3 text-center transition-colors hover:bg-gray-100/80"
                                            >
                                                {miniIcon}
                                                <span className="mt-1 text-[8px] font-black tracking-wider text-gray-500">
                                                    {item}
                                                </span>
                                            </div>
                                        );
                                    },
                                )}
                            </div>

                            {/* Action Button */}
                            <Button
                                onClick={() => setIsConnectModalOpen(true)}
                                className="h-11 w-full rounded-xl bg-[#0f172a] text-xs font-bold tracking-wider text-white shadow-sm transition-all duration-300 hover:bg-[#1e293b]"
                            >
                                Connect Storage
                            </Button>
                        </CardContent>
                    </Card>

                    {/* Total Usage widget */}
                    <div className="group relative overflow-hidden rounded-2xl bg-[#bd1e24] p-6 text-white shadow-lg transition-all duration-300 hover:shadow-xl">
                        <div className="absolute -top-6 -right-6 h-28 w-28 rounded-full bg-white/5 transition-transform duration-500 group-hover:scale-110" />
                        <div className="absolute -top-3 -right-3 flex h-16 w-16 items-center justify-center rounded-full border border-white/25 bg-white/10 shadow-sm backdrop-blur-sm">
                            <TrendingUp
                                className="h-6 w-6 text-white"
                                strokeWidth={2.5}
                            />
                        </div>

                        <div>
                            <span className="text-[10px] font-black tracking-widest text-white/70">
                                TOTAL USAGE
                            </span>
                            <h4 className="mt-2 text-4xl font-black tracking-tight">
                                {formatBytes(totalUsedBytes)}
                            </h4>

                            {connections.length > 0 ? (
                                <p className="mt-4 text-xs leading-relaxed font-medium text-white/80">
                                    Monitoring active sync over{' '}
                                    {connections.length} connected cloud storage
                                    accounts.
                                </p>
                            ) : (
                                <p className="mt-4 text-xs leading-relaxed font-medium text-white/80">
                                    No storages connected. Connect a cloud
                                    storage service to track active usage.
                                </p>
                            )}

                            <a
                                href="#"
                                className="mt-6 inline-flex items-center gap-1 text-xs font-extrabold tracking-wide hover:underline"
                            >
                                Manage Billing{' '}
                                <ChevronRight className="h-3 w-3" />
                            </a>
                        </div>
                    </div>
                </div>
            </div>

            {/* Custom Premium Connect Cloud Storage Modal */}
            {isConnectModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 p-4 backdrop-blur-sm">
                    <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-gray-100 bg-white p-6 shadow-2xl transition-all">
                        {/* Close button */}
                        <button
                            onClick={() => setIsConnectModalOpen(false)}
                            className="absolute top-4 right-4 rounded-xl p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
                        >
                            <X className="h-5 w-5" />
                        </button>

                        <div className="mb-6">
                            <h3 className="text-xl font-extrabold tracking-tight text-gray-900">
                                Connect Storage
                            </h3>
                            <p className="mt-1 text-xs font-medium text-gray-400">
                                Select a cloud storage provider to link your
                                account
                            </p>
                        </div>

                        <div className="space-y-3">
                            {/* Google Drive - Active */}
                            <button
                                onClick={handleConnectGoogle}
                                className="group flex w-full items-center justify-between rounded-2xl border border-gray-100 bg-white p-4 text-left shadow-sm transition-all duration-300 hover:border-blue-200 hover:bg-blue-50/20"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500/10">
                                        <img
                                            src="/assets/svg/GoogleDrive.svg"
                                            className="h-6 w-6"
                                            alt="Google Drive"
                                        />
                                    </div>
                                    <div>
                                        <h5 className="text-sm font-bold text-gray-900">
                                            Google Drive
                                        </h5>
                                        <span className="mt-1 inline-block rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-600">
                                            Active
                                        </span>
                                    </div>
                                </div>
                                <ChevronRight className="h-5 w-5 text-gray-400 transition-all group-hover:translate-x-1 group-hover:text-blue-600" />
                            </button>

                            {/* OneDrive - Coming soon */}
                            <div className="flex w-full items-center justify-between rounded-2xl border border-gray-100 bg-gray-50/50 p-4 text-left opacity-75 select-none">
                                <div className="flex items-center gap-4">
                                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500/5 text-gray-400">
                                        <Cloud className="h-6 w-6" />
                                    </div>
                                    <div>
                                        <h5 className="text-sm font-bold text-gray-500">
                                            OneDrive
                                        </h5>
                                        <span className="mt-1 inline-block rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-400">
                                            Coming Soon
                                        </span>
                                    </div>
                                </div>
                                <Lock className="mr-1 h-4 w-4 text-gray-300" />
                            </div>

                            {/* AWS S3 - Coming soon */}
                            <div className="flex w-full items-center justify-between rounded-2xl border border-gray-100 bg-gray-50/50 p-4 text-left opacity-75 select-none">
                                <div className="flex items-center gap-4">
                                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-500/5 text-gray-400">
                                        <Database className="h-6 w-6" />
                                    </div>
                                    <div>
                                        <h5 className="text-sm font-bold text-gray-500">
                                            AWS S3
                                        </h5>
                                        <span className="mt-1 inline-block rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-400">
                                            Coming Soon
                                        </span>
                                    </div>
                                </div>
                                <Lock className="mr-1 h-4 w-4 text-gray-300" />
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </AuthenticatedLayout>
    );
}
