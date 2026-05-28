import { CloudOff, HardDrive, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import type { CloudConnection } from '@/types/cloud';

interface StorageOverviewCardsProps {
    connections: CloudConnection[];
    onConnect: () => void;
    onDisconnect: (id: number, name: string) => void;
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
    onDisconnect,
}: StorageOverviewCardsProps) {
    if (connections.length === 0) {
        return (
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
                    Connect your cloud storage providers to start centralizing
                    and managing your files safely within one unified dashboard.
                </p>
                <div className="mt-6">
                    <Button
                        onClick={onConnect}
                        className="h-11 rounded-xl bg-[#0f172a] px-6 text-xs font-bold tracking-wider text-white shadow-sm transition-all duration-300 hover:bg-[#1e293b]"
                    >
                        Connect Your First Storage
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {connections.map((connection) => (
                <Card
                    key={connection.id}
                    className="group relative overflow-hidden rounded-2xl border border-gray-100/50 bg-white p-6 shadow-sm ring-0 transition-all duration-300 hover:-translate-y-1 hover:shadow-md"
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
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-black tracking-widest text-gray-400">
                                    {connection.provider.toUpperCase()}
                                </span>
                                <button
                                    type="button"
                                    onClick={() =>
                                        onDisconnect(
                                            connection.id,
                                            connection.name,
                                        )
                                    }
                                    className="rounded-lg p-1.5 text-gray-400 opacity-0 transition-all group-hover:opacity-100 hover:bg-red-50 hover:text-red-600 focus:opacity-100"
                                    aria-label={`Disconnect ${connection.name}`}
                                    title="Disconnect Storage"
                                >
                                    <Trash2
                                        className="h-4 w-4"
                                        aria-hidden="true"
                                    />
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
            ))}
        </div>
    );
}
