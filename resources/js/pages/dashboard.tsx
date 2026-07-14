import { Head } from '@inertiajs/react';
import { Cloud, Database } from 'lucide-react';
import { useState } from 'react';
import ConnectStorageModal from '@/components/cloud/ConnectStorageModal';
import RecentActivityList from '@/components/cloud/RecentActivityList';
import StorageOverviewCards from '@/components/cloud/StorageOverviewCards';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout';
import type { ActivityLogEntry } from '@/types/activity';
import type { AvailableProvider, CloudConnection } from '@/types/cloud';

interface DashboardProps {
    connections: CloudConnection[];
    availableProviders: AvailableProvider[];
    recentActivities: ActivityLogEntry[];
}

function providerMiniIcon(provider: AvailableProvider) {
    if (provider.icon?.endsWith('.svg')) {
        return (
            <img
                src={provider.icon}
                className="h-5 w-5"
                alt={provider.label}
            />
        );
    }

    if (provider.key === 'aws-s3') {
        return <Database className="h-5 w-5 text-muted-foreground" />;
    }

    return <Cloud className="h-5 w-5 text-muted-foreground" />;
}

export default function Dashboard({
    connections = [],
    availableProviders = [],
    recentActivities = [],
}: Readonly<DashboardProps>) {
    const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);

    return (
        <AuthenticatedLayout title="Workspace">
            <Head title="Dashboard" />

            <div className="mb-4 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                    <span className="text-[10px] font-extrabold tracking-widest text-muted-foreground">
                        SYSTEM HEALTH
                    </span>
                    <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-foreground">
                        Storage Overview
                    </h2>
                </div>
                <div className="flex items-center gap-2 self-start rounded-full border border-primary/20 bg-primary/10 px-4 py-1.5 text-xs font-semibold text-primary shadow-sm sm:self-center">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
                    All systems operational
                </div>
            </div>

            <StorageOverviewCards
                connections={connections}
                onConnect={() => setIsConnectModalOpen(true)}
            />

            <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-3">
                <RecentActivityList activities={recentActivities} />

                <div className="space-y-6 lg:col-span-1">
                    <Card className="rounded-2xl border border-border bg-card p-6 shadow-sm ring-0">
                        <CardContent className="p-0">
                            <h4 className="text-lg font-black tracking-tight text-foreground">
                                Cloud Hub
                            </h4>
                            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                                Centralize your data. Connect another provider
                                to manage all files from one dashboard.
                            </p>

                            <div className="my-6 grid grid-cols-3 gap-3">
                                {availableProviders.map((provider) => (
                                    <div
                                        key={provider.key}
                                        className="flex flex-col items-center justify-center rounded-xl border border-border bg-muted py-3 text-center transition-colors hover:bg-muted/70"
                                    >
                                        {providerMiniIcon(provider)}
                                        <span className="mt-1 text-[8px] font-black tracking-wider text-muted-foreground">
                                            {provider.label.toUpperCase()}
                                        </span>
                                    </div>
                                ))}
                            </div>

                            <Button
                                onClick={() => setIsConnectModalOpen(true)}
                                className="h-11 w-full rounded-xl bg-foreground text-xs font-bold tracking-wider text-background shadow-sm transition-all duration-300 hover:bg-foreground/90"
                            >
                                Connect Storage
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {isConnectModalOpen && (
                <ConnectStorageModal
                    providers={availableProviders}
                    onClose={() => setIsConnectModalOpen(false)}
                />
            )}
        </AuthenticatedLayout>
    );
}
