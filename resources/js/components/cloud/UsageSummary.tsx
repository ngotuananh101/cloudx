import { TrendingUp } from 'lucide-react';
import { formatBytes } from '@/lib/format-bytes';
import type { CloudConnection } from '@/types/cloud';

interface UsageSummaryProps {
    connections: CloudConnection[];
}

export default function UsageSummary({ connections }: UsageSummaryProps) {
    const totalUsedBytes = connections.reduce((acc, connection) => acc + (connection.used_space || 0), 0);

    return (
        <div className="group relative overflow-hidden rounded-2xl bg-[#bd1e24] p-6 text-white shadow-lg transition-all duration-300 hover:shadow-xl">
            <div className="absolute -top-6 -right-6 h-28 w-28 rounded-full bg-white/5 transition-transform duration-500 group-hover:scale-110" />
            <div className="absolute -top-3 -right-3 flex h-16 w-16 items-center justify-center rounded-full border border-white/25 bg-white/10 shadow-sm backdrop-blur-sm">
                <TrendingUp className="h-6 w-6 text-white" strokeWidth={2.5} />
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
                        Monitoring active sync over {connections.length} connected cloud storage accounts.
                    </p>
                ) : (
                    <p className="mt-4 text-xs leading-relaxed font-medium text-white/80">
                        No storages connected. Connect a cloud storage service to track active usage.
                    </p>
                )}
            </div>
        </div>
    );
}
