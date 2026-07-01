import { ArrowRightLeft, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface BulkFileActionsBarProps {
    selectedCount: number;
    canDelete?: boolean;
    canMove?: boolean;
    onDelete: () => void;
    onMove: () => void;
    onClear: () => void;
}

export function BulkFileActionsBar({
    selectedCount,
    canDelete,
    canMove,
    onDelete,
    onMove,
    onClear,
}: BulkFileActionsBarProps) {
    if (selectedCount === 0) {
        return null;
    }

    return (
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm font-semibold text-foreground">
                {selectedCount} selected
            </div>
            <div className="flex flex-wrap items-center gap-2">
                {canMove && (
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={onMove}
                        className="rounded-lg"
                    >
                        <ArrowRightLeft className="h-4 w-4" />
                        Move selected
                    </Button>
                )}
                {canDelete && (
                    <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={onDelete}
                        className="rounded-lg"
                    >
                        <Trash2 className="h-4 w-4" />
                        Delete selected
                    </Button>
                )}
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={onClear}
                    className="rounded-lg"
                >
                    <X className="h-4 w-4" />
                    Clear
                </Button>
            </div>
        </div>
    );
}
