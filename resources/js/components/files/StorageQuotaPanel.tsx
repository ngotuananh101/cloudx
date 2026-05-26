import { router } from '@inertiajs/react';
import { HardDrive, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { formatBytes } from '@/lib/format-bytes';
import type { CloudConnection } from '@/types/cloud';

interface StorageQuotaPanelProps {
    connection: CloudConnection;
    currentPath: string;
}

export function StorageQuotaPanel({ connection, currentPath }: StorageQuotaPanelProps) {
    const quota = connection.storageQuota;

    const refreshCache = (scope: 'cloud' | 'folder') => {
        router.delete(`/cloud-connections/${connection.id}/cache`, {
            data: scope === 'folder' ? { path: currentPath } : {},
            preserveScroll: true,
        });
    };

    return (
        <aside className="rounded-2xl border border-gray-100/70 bg-white p-5 shadow-sm">
            <div className="mb-5 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-50 text-brand">
                    {connection.provider_icon?.endsWith('.svg') ? (
                        <img src={connection.provider_icon} className="h-6 w-6" alt={connection.provider_label || connection.name} />
                    ) : (
                        <HardDrive className="h-6 w-6" strokeWidth={2} />
                    )}
                </div>
                <div className="min-w-0">
                    <div className="text-[10px] font-black tracking-widest text-gray-400">
                        SELECTED CLOUD
                    </div>
                    <div className="truncate text-sm font-extrabold text-gray-900" title={connection.name}>
                        {connection.name}
                    </div>
                </div>
            </div>

            {quota?.supported ? (
                <div className="space-y-4">
                    <div>
                        <div className="mb-2 flex items-baseline justify-between gap-3">
                            <span className="text-2xl font-black tracking-tight text-gray-900">
                                {formatBytes(quota.usedBytes || 0)}
                            </span>
                            <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-extrabold text-brand">
                                {quota.usedPercent ?? 0}% Used
                            </span>
                        </div>
                        <Progress value={quota.usedPercent ?? 0} className="h-2 bg-gray-100 [&>div]:bg-brand" />
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs">
                        <div className="rounded-xl bg-gray-50 p-3">
                            <div className="font-bold text-gray-400">Available</div>
                            <div className="mt-1 font-black text-gray-900">
                                {formatBytes(quota.remainingBytes || 0)}
                            </div>
                        </div>
                        <div className="rounded-xl bg-gray-50 p-3">
                            <div className="font-bold text-gray-400">Total</div>
                            <div className="mt-1 font-black text-gray-900">
                                {formatBytes(quota.totalBytes || 0)}
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1">
                        <Button type="button" variant="outline" className="h-9 rounded-xl text-[11px] font-bold" onClick={() => refreshCache('folder')}>
                            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                            Folder
                        </Button>
                        <Button type="button" variant="outline" className="h-9 rounded-xl text-[11px] font-bold" onClick={() => refreshCache('cloud')}>
                            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                            Cloud
                        </Button>
                    </div>
                </div>
            ) : (
                <p className="text-xs leading-relaxed font-medium text-gray-500">
                    Storage quota is not available for this cloud account yet.
                </p>
            )}
        </aside>
    );
}
