import { useState } from 'react';
import { Head, router } from '@inertiajs/react';
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
    ChevronRight,
    CloudOff,
    Trash2,
    X,
    Lock
} from 'lucide-react';

interface Connection {
    id: number;
    name: string;
    provider: string;
    provider_value: number;
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
            router.delete(`/cloud-connections/${id}`);
        }
    };

    const handleConnectGoogle = () => {
        setIsConnectModalOpen(false);
        window.location.href = route('oauth.google.redirect');
    };

    // Calculate total statistics
    const totalUsedBytes = connections.reduce((acc, c) => acc + (c.used_space || 0), 0);

    const formatBytes = (bytes: number, precision = 1) => {
        if (bytes <= 0) return '0 B';
        const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
        const pow = Math.floor(Math.log(bytes) / Math.log(1024));
        const unitLimit = Math.min(pow, units.length - 1);
        return (bytes / Math.pow(1024, unitLimit)).toFixed(precision) + ' ' + units[unitLimit];
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
                    <span className="text-[10px] font-extrabold tracking-widest text-gray-400">SYSTEM HEALTH</span>
                    <h2 className="text-2xl font-extrabold tracking-tight text-gray-900 mt-1">Storage Overview</h2>
                </div>
                <div className="flex items-center gap-2 self-start rounded-full bg-emerald-50 px-4 py-1.5 text-xs font-semibold text-emerald-700 border border-emerald-100 sm:self-center shadow-sm">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    All systems operational
                </div>
            </div>

            {/* Storage Cards Grid / Empty State */}
            {connections.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-3xl border border-gray-200/60 bg-white p-12 text-center shadow-sm">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-50 text-gray-400 mb-6 border border-gray-100">
                        <CloudOff className="h-8 w-8 text-gray-400" strokeWidth={1.5} />
                    </div>
                    <h3 className="text-lg font-extrabold text-gray-900 tracking-tight">No Connected Storages</h3>
                    <p className="mt-2 max-w-sm text-sm font-medium text-gray-500 leading-relaxed">
                        Connect your cloud storage providers to start centralizing and managing your files safely within one unified dashboard.
                    </p>
                    <div className="mt-6">
                        <Button
                            onClick={() => setIsConnectModalOpen(true)}
                            className="h-11 rounded-xl bg-[#0f172a] hover:bg-[#1e293b] px-6 font-bold text-xs tracking-wider text-white shadow-sm transition-all duration-300"
                        >
                            Connect Your First Storage
                        </Button>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {connections.map((connection) => {
                        let providerIcon = HardDrive;
                        let colorClass = 'bg-amber-500/10 text-amber-600';
                        if (connection.provider_value === 1) { // Google Drive
                            providerIcon = Cloud;
                            colorClass = 'bg-blue-500/10 text-blue-600';
                        }

                        return (
                            <Card
                                key={connection.id}
                                className="group relative overflow-hidden rounded-2xl border border-gray-100/50 ring-0 bg-white p-6 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1"
                            >
                                <CardContent className="p-0">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${colorClass}`}>
                                            <providerIcon className="h-6 w-6" strokeWidth={2} />
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-black tracking-widest text-gray-400">
                                                {connection.provider.toUpperCase()}
                                            </span>
                                            <button
                                                onClick={() => handleDisconnect(connection.id, connection.name)}
                                                className="rounded-lg p-1.5 opacity-0 group-hover:opacity-100 hover:bg-red-50 text-gray-400 hover:text-red-600 transition-all"
                                                title="Disconnect Storage"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="mb-3 flex justify-between items-baseline">
                                        <div className="flex items-baseline gap-1">
                                            <span className="text-2xl font-extrabold text-gray-900 tracking-tight">
                                                {connection.used_formatted}
                                            </span>
                                            <span className="text-xs font-semibold text-gray-400">
                                                /{connection.total_formatted}
                                            </span>
                                        </div>
                                        <span className="text-[10px] font-extrabold text-brand bg-red-50/50 px-2 py-0.5 rounded-full">
                                            {connection.percent}% Used
                                        </span>
                                    </div>

                                    <div className="relative pt-1">
                                        <Progress
                                            value={connection.percent}
                                            className="h-2 bg-gray-100 [&>div]:bg-brand"
                                        />
                                    </div>

                                    <div className="mt-3 text-[10px] font-bold text-gray-500 truncate">
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
                                {['GOOGLE', 'ONEDRIVE', 'AWS S3'].map((item) => (
                                    <div key={item} className="flex flex-col items-center justify-center rounded-xl bg-gray-50 py-3 text-center border border-gray-100/50 hover:bg-gray-100/80 transition-colors">
                                        <Cloud className="h-5 w-5 text-gray-400" />
                                        <span className="mt-1 text-[8px] font-black tracking-wider text-gray-500">{item}</span>
                                    </div>
                                ))}
                            </div>

                            {/* Action Button */}
                            <Button
                                onClick={() => setIsConnectModalOpen(true)}
                                className="h-11 w-full rounded-xl bg-[#0f172a] font-bold text-xs tracking-wider text-white hover:bg-[#1e293b] shadow-sm transition-all duration-300"
                            >
                                Connect Storage
                            </Button>
                        </CardContent>
                    </Card>

                    {/* Total Usage widget */}
                    <div className="relative overflow-hidden rounded-2xl bg-[#bd1e24] p-6 text-white shadow-lg hover:shadow-xl transition-all duration-300 group">
                        <div className="absolute -right-6 -top-6 h-28 w-28 rounded-full bg-white/5 group-hover:scale-110 transition-transform duration-500" />
                        <div className="absolute -right-3 -top-3 flex h-16 w-16 items-center justify-center rounded-full border border-white/25 bg-white/10 shadow-sm backdrop-blur-sm">
                            <TrendingUp className="h-6 w-6 text-white" strokeWidth={2.5} />
                        </div>

                        <div>
                            <span className="text-[10px] font-black tracking-widest text-white/70">TOTAL USAGE</span>
                            <h4 className="mt-2 text-4xl font-black tracking-tight">{formatBytes(totalUsedBytes)}</h4>

                            {connections.length > 0 ? (
                                <p className="mt-4 text-xs font-medium text-white/80 leading-relaxed">
                                    Monitoring active sync over {connections.length} connected cloud storage accounts.
                                </p>
                            ) : (
                                <p className="mt-4 text-xs font-medium text-white/80 leading-relaxed">
                                    No storages connected. Connect a cloud storage service to track active usage.
                                </p>
                            )}

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

            {/* Custom Premium Connect Cloud Storage Modal */}
            {isConnectModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 p-4 backdrop-blur-sm">
                    <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-gray-100 bg-white p-6 shadow-2xl transition-all">
                        {/* Close button */}
                        <button
                            onClick={() => setIsConnectModalOpen(false)}
                            className="absolute right-4 top-4 rounded-xl p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
                        >
                            <X className="h-5 w-5" />
                        </button>

                        <div className="mb-6">
                            <h3 className="text-xl font-extrabold text-gray-900 tracking-tight">Connect Storage</h3>
                            <p className="text-xs font-medium text-gray-400 mt-1">Select a cloud storage provider to link your account</p>
                        </div>

                        <div className="space-y-3">
                            {/* Google Drive - Active */}
                            <button
                                onClick={handleConnectGoogle}
                                className="flex w-full items-center justify-between rounded-2xl border border-gray-100 bg-white p-4 shadow-sm hover:bg-blue-50/20 hover:border-blue-200 transition-all duration-300 text-left group"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600">
                                        <Cloud className="h-6 w-6" />
                                    </div>
                                    <div>
                                        <h5 className="text-sm font-bold text-gray-900">Google Drive</h5>
                                        <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full mt-1 inline-block">Active</span>
                                    </div>
                                </div>
                                <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
                            </button>

                            {/* OneDrive - Coming soon */}
                            <div className="flex w-full items-center justify-between rounded-2xl border border-gray-100 bg-gray-50/50 p-4 text-left opacity-75 select-none">
                                <div className="flex items-center gap-4">
                                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500/5 text-gray-400">
                                        <Cloud className="h-6 w-6" />
                                    </div>
                                    <div>
                                        <h5 className="text-sm font-bold text-gray-500">OneDrive</h5>
                                        <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full mt-1 inline-block">Coming Soon</span>
                                    </div>
                                </div>
                                <Lock className="h-4 w-4 text-gray-300 mr-1" />
                            </div>

                            {/* AWS S3 - Coming soon */}
                            <div className="flex w-full items-center justify-between rounded-2xl border border-gray-100 bg-gray-50/50 p-4 text-left opacity-75 select-none">
                                <div className="flex items-center gap-4">
                                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-500/5 text-gray-400">
                                        <Database className="h-6 w-6" />
                                    </div>
                                    <div>
                                        <h5 className="text-sm font-bold text-gray-500">AWS S3</h5>
                                        <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full mt-1 inline-block">Coming Soon</span>
                                    </div>
                                </div>
                                <Lock className="h-4 w-4 text-gray-300 mr-1" />
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </AuthenticatedLayout>
    );
}
