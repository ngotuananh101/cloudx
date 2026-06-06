import { CloudOff, HardDrive } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import type { CloudConnection } from '@/types/cloud';

interface StorageOverviewCardsProps {
    connections: CloudConnection[];
    onConnect: () => void;
}

function getProviderColorClass(providerValue?: number): string {
    if (providerValue === 1) {
        return 'bg-blue-500/10 text-blue-600';
    }

    if (providerValue === 2) {
        return 'bg-indigo-500/10 text-indigo-600';
    }

    if (providerValue === 3) {
        return 'bg-blue-500/10 text-blue-600';
    }

    if (providerValue === 4) {
        return 'bg-orange-500/10 text-orange-600';
    }

    return 'bg-amber-500/10 text-amber-600';
}

export default function StorageOverviewCards({
    connections,
    onConnect,
}: StorageOverviewCardsProps) {
    if (connections.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center rounded-3xl border border-gray-200/60 dark:border-gray-800 bg-white dark:bg-gray-900 p-12 text-center shadow-sm">
                <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 text-gray-400 dark:text-gray-500">
                    <CloudOff
                        className="h-8 w-8 text-gray-400 dark:text-gray-500"
                        strokeWidth={1.5}
                    />
                </div>
                <h3 className="text-lg font-extrabold tracking-tight text-gray-900 dark:text-gray-100">
                    No Connected Storages
                </h3>
                <p className="mt-2 max-w-sm text-sm leading-relaxed text-gray-500 dark:text-gray-400">
                    Connect your cloud storage providers to start centralizing
                    and managing your files safely within one unified dashboard.
                </p>
                <div className="mt-6">
                    <Button
                        onClick={onConnect}
                        className="h-11 rounded-xl bg-[#0f172a] dark:bg-white px-6 text-xs font-bold tracking-wider text-white dark:text-[#0f172a] shadow-sm transition-all duration-300 hover:bg-[#1e293b] dark:hover:bg-gray-200"
                    >
                        Connect Your First Storage
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
            {connections.map((connection) => (
                <Card
                    key={connection.id}
                    className="group relative overflow-hidden rounded-2xl border border-gray-100/50 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-sm ring-0 transition-all duration-300 hover:-translate-y-1 hover:shadow-md"
                >
                    <CardContent className="p-0">
                        <div className="mb-4 flex items-center justify-between">
                            <div
                                className={`flex h-11 w-11 items-center justify-center rounded-xl ${getProviderColorClass(connection.provider_value)}`}
                            >
                                {connection.provider_icon?.endsWith('.svg') ? (
                                    <img
                                        src={connection.provider_icon}
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
                            <span className="text-[10px] font-black tracking-widest text-gray-400 dark:text-gray-500">
                                {connection.provider.toUpperCase()}
                            </span>
                        </div>

                        <div className="mb-3 flex items-baseline justify-between">
                            <div className="flex items-baseline gap-1">
                                <span className="text-2xl font-extrabold tracking-tight text-gray-900 dark:text-gray-100">
                                    {connection.used_formatted}
                                </span>
                                <span className="text-xs font-semibold text-gray-400 dark:text-gray-500">
                                    /{connection.total_formatted}
                                </span>
                            </div>
                            <span className="rounded-full bg-red-50/50 dark:bg-red-950/30 px-2 py-0.5 text-[10px] font-extrabold text-brand">
                                {connection.percent}% Used
                            </span>
                        </div>

                        <div className="relative pt-1">
                            <Progress
                                value={connection.percent}
                                className="h-2 bg-gray-100 [&>div]:bg-brand"
                            />
                        </div>

                        <div className="mt-3 truncate text-[10px] font-bold text-gray-500 dark:text-gray-400">
                            {connection.name}
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}
