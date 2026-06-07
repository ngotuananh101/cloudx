import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef } from 'react';
import { FileTableRow } from '@/components/FileTableRow';
import type { CloudFile, ProviderCapabilities } from '@/types/cloud';
import { EmptyFileState } from './EmptyFileState';

interface VirtualizedFileTableProps {
    files: CloudFile[];
    searchQuery: string;
    capabilities?: ProviderCapabilities;
    onNavigate: (item: CloudFile) => void;
    onPreview?: (item: CloudFile) => void;
    onMove?: (item: CloudFile) => void;
    onDelete?: (item: CloudFile) => void;
    connectionId: number;
}

export function VirtualizedFileTable({
    files,
    searchQuery,
    capabilities,
    onNavigate,
    onPreview,
    onMove,
    onDelete,
    connectionId,
}: VirtualizedFileTableProps) {
    const parentRef = useRef<HTMLDivElement>(null);

    const rowVirtualizer = useVirtualizer({
        count: files.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 48,
        overscan: 15,
    });

    return (
        <div className="flex h-[calc(100vh-180px)] min-h-100 flex-col overflow-hidden rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm">
            <div className="flex items-center border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50 py-3 pr-6 pl-6 text-[11px] font-extrabold tracking-wider text-gray-400 dark:text-gray-500">
                <div className="flex-1 pr-4">NAME</div>
                <div className="w-32 shrink-0 pr-4">SIZE</div>
                <div className="w-32 shrink-0 pr-4">TYPE</div>
                <div className="w-32 shrink-0 pr-4">MODIFIED</div>
                <div className="w-24 shrink-0 text-right">ACTIONS</div>
                <div className="w-3.5 shrink-0" />
            </div>

            <div
                ref={parentRef}
                className="custom-scrollbar flex-1 overflow-x-hidden overflow-y-scroll"
            >
                {files.length === 0 ? (
                    <EmptyFileState searchQuery={searchQuery} />
                ) : (
                    <div
                        style={{
                            height: `${rowVirtualizer.getTotalSize()}px`,
                            width: '100%',
                            position: 'relative',
                        }}
                    >
                        {rowVirtualizer.getVirtualItems().map((virtualItem) => {
                            const file = files[virtualItem.index];

                            return (
                                <FileTableRow
                                    key={file.id}
                                    item={file}
                                    capabilities={capabilities}
                                    onNavigate={onNavigate}
                                    onPreview={onPreview}
                                    onMove={onMove}
                                    onDelete={onDelete}
                                    connectionId={connectionId}
                                    style={{
                                        position: 'absolute',
                                        top: 0,
                                        left: 0,
                                        width: '100%',
                                        height: `${virtualItem.size}px`,
                                        transform: `translateY(${virtualItem.start}px)`,
                                    }}
                                />
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
