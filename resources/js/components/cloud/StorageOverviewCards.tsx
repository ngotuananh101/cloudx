import { CloudOff, HardDrive } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import type { CloudConnection } from '@/types/cloud';

interface StorageOverviewCardsProps {
    connections: CloudConnection[];
    onConnect: () => void;
}

function getProviderColorClass(): string {
    return 'bg-primary/10 text-primary';
}

export default function StorageOverviewCards({
    connections,
    onConnect,
}: StorageOverviewCardsProps) {
    if (connections.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center rounded-3xl border border-border bg-card p-12 text-center shadow-sm">
                <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-muted text-muted-foreground">
                    <CloudOff
                        className="h-8 w-8 text-muted-foreground"
                        strokeWidth={1.5}
                    />
                </div>
                <h3 className="text-lg font-extrabold tracking-tight text-foreground">
                    No Connected Storages
                </h3>
                <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
                    Connect your cloud storage providers to start centralizing
                    and managing your files safely within one unified dashboard.
                </p>
                <div className="mt-6">
                    <Button
                        onClick={onConnect}
                        className="h-11 rounded-xl bg-foreground px-6 text-xs font-bold tracking-wider text-background shadow-sm transition-all duration-300 hover:bg-foreground/90"
                    >
                        Connect Your First Storage
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {connections.map((connection) => (
                <Card
                    key={connection.id}
                    className="group relative overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-sm ring-0 transition-all duration-300 hover:-translate-y-1 hover:shadow-md"
                >
                    <CardContent className="p-0">
                        <div className="mb-4 flex items-center justify-between">
                            <div
                                className={`flex h-11 w-11 items-center justify-center rounded-xl ${getProviderColorClass()}`}
                            >
                                {connection.provider_icon?.endsWith('.svg') ? (
                                    <img
                                        src={connection.provider_icon}
                                        className="h-6 w-6"
                                        alt={
                                            connection.provider_label ??
                                            'Storage'
                                        }
                                    />
                                ) : (
                                    <HardDrive
                                        className="h-6 w-6"
                                        strokeWidth={2}
                                    />
                                )}
                            </div>
                            <span className="text-[10px] font-semibold tracking-widest text-muted-foreground">
                                {connection.provider_label?.toUpperCase() ?? ''}
                            </span>
                        </div>

                        <div className="mb-3 flex items-baseline justify-between">
                            <div className="flex items-baseline gap-1">
                                <span className="text-xl font-bold tracking-tight text-foreground">
                                    {connection.used_formatted}
                                </span>
                                <span className="text-xs font-semibold text-muted-foreground">
                                    /{connection.total_formatted}
                                </span>
                            </div>
                            <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-extrabold text-primary">
                                {connection.percent}% Used
                            </span>
                        </div>

                        <div className="relative pt-1">
                            <Progress
                                value={connection.percent}
                                className="h-2 bg-muted [&>div]:bg-primary"
                            />
                        </div>

                        <div className="mt-3 truncate text-[10px] font-bold text-muted-foreground">
                            {connection.name}
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}
