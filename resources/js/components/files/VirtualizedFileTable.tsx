import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef } from 'react';
import { FileTableRow } from '@/components/FileTableRow';
import { Checkbox } from '@/components/ui/checkbox';
import type { CloudFile, ProviderCapabilities } from '@/types/cloud';
import { EmptyFileState } from './EmptyFileState';

interface VirtualizedFileTableProps {
    files: CloudFile[];
    searchQuery: string;
    capabilities?: ProviderCapabilities;
    onNavigate: (item: Readonly<CloudFile>) => void;
    onPreview?: (item: Readonly<CloudFile>) => void;
    onMove?: (item: Readonly<CloudFile>) => void;
    onShare?: (item: Readonly<CloudFile>) => void;
    onDelete?: (item: Readonly<CloudFile>) => void;
    selectedPaths: Set<string>;
    isAllSelected: boolean;
    isPartiallySelected: boolean;
    onToggleSelection: (item: CloudFile, selected: boolean) => void;
    onToggleSelectAll: (selected: boolean) => void;
    connectionId: number;
}

export function VirtualizedFileTable({
    files,
    searchQuery,
    capabilities,
    onNavigate,
    onPreview,
    onMove,
    onShare,
    onDelete,
    selectedPaths,
    isAllSelected,
    isPartiallySelected,
    onToggleSelection,
    onToggleSelectAll,
    connectionId,
}: Readonly<VirtualizedFileTableProps>) {
    const parentRef = useRef<HTMLDivElement>(null);

    // eslint-disable-next-line react-hooks/incompatible-library
    const rowVirtualizer = useVirtualizer({
        count: files.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 48,
        overscan: 15,
    });

    return (
        <div className="flex h-full min-h-100 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <div className="flex items-center border-b border-border bg-muted/50 py-3 pr-6 pl-4 text-[11px] font-extrabold tracking-wider text-muted-foreground">
                <div className="flex w-10 shrink-0 items-center justify-start">
                    <Checkbox
                        checked={
                            isPartiallySelected
                                ? 'indeterminate'
                                : isAllSelected
                        }
                        disabled={files.length === 0}
                        onCheckedChange={(checked) =>
                            onToggleSelectAll(checked === true)
                        }
                        aria-label="Select all visible items"
                    />
                </div>
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
                                    onShare={onShare}
                                    onDelete={onDelete}
                                    isSelected={selectedPaths.has(file.path)}
                                    onSelect={onToggleSelection}
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
