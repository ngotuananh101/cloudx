import { router } from '@inertiajs/react';
import { Folder, ChevronRight, CornerLeftUp, Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { encodeCloudPath } from '@/lib/cloud-path';
import connections from '@/routes/connections';
import type { CloudFile } from '@/types/cloud';

interface MoveItemModalProps {
    isOpen: boolean;
    onClose: () => void;
    item?: CloudFile | null;
    items?: CloudFile[];
    connectionId: number;
    currentParentPath: string;
    onMoved?: () => void;
}

export default function MoveItemModal({
    isOpen,
    onClose,
    item = null,
    items = [],
    connectionId,
    currentParentPath,
    onMoved,
}: MoveItemModalProps) {
    const [destinationPath, setDestinationPath] = useState(currentParentPath);
    const [folders, setFolders] = useState<CloudFile[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isMoving, setIsMoving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const selectedItems = items.length > 0 ? items : item ? [item] : [];
    const targetItem = selectedItems[0] ?? null;
    const isBulkMove = selectedItems.length > 1;

    useEffect(() => {
        if (!isOpen) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setDestinationPath(currentParentPath);

            setFolders([]);

            setError(null);

            return;
        }

        fetchFolders(currentParentPath);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, currentParentPath, connectionId]);

    async function fetchFolders(path: string) {
        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch(
                `${connections.folders.index.url({ connection: connectionId })}?path=${encodeCloudPath(path)}`,
            );

            if (!response.ok) {
                throw new Error('Failed to fetch folders');
            }

            const data = await response.json();
            setFolders(data);
            setDestinationPath(path);
        } catch (err: any) {
            setError(err.message || 'An error occurred');
        } finally {
            setIsLoading(false);
        }
    }

    const handleMove = () => {
        if (selectedItems.length === 0) {
            return;
        }

        setIsMoving(true);
        router.post(
            connections.items.move.url({ connection: connectionId }),
            selectedItems.length === 1
                ? {
                      source_path: selectedItems[0].path,
                      is_directory: selectedItems[0].isDirectory,
                      destination_folder: destinationPath,
                  }
                : {
                      items: selectedItems.map((selectedItem) => ({
                          path: selectedItem.path,
                          is_directory: selectedItem.isDirectory,
                      })),
                      destination_folder: destinationPath,
                  },
            {
                preserveScroll: true,
                onSuccess: () => {
                    onMoved?.();
                    onClose();
                },
                onFinish: () => {
                    setIsMoving(false);
                },
            },
        );
    };

    const navigateUp = () => {
        const parts = destinationPath.split('/').filter(Boolean);
        parts.pop();
        const newPath = parts.join('/');
        fetchFolders(newPath);
    };

    const isFolderInsideSelectedFolder = (folder: CloudFile) => {
        return selectedItems.some((selectedItem) => {
            if (!selectedItem.isDirectory) {
                return false;
            }

            const selectedPathWithSlash = `${selectedItem.path}/`;
            const folderPathWithSlash = `${folder.path}/`;

            return (
                folder.path === selectedItem.path ||
                folderPathWithSlash.startsWith(selectedPathWithSlash)
            );
        });
    };

    const isDestinationValid = () => {
        if (selectedItems.length === 0) {
            return false;
        }

        if (destinationPath === currentParentPath) {
            return false;
        }

        return !selectedItems.some((selectedItem) => {
            if (!selectedItem.isDirectory) {
                return false;
            }

            const destinationWithSlash = destinationPath
                ? `${destinationPath}/`
                : '';
            const selectedPathWithSlash = `${selectedItem.path}/`;

            return (
                destinationPath === selectedItem.path ||
                destinationWithSlash.startsWith(selectedPathWithSlash)
            );
        });
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="border-border bg-card sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="text-foreground">
                        {isBulkMove
                            ? `Move ${selectedItems.length} items`
                            : `Move "${targetItem?.name ?? ''}"`}
                    </DialogTitle>
                    <DialogDescription className="text-muted-foreground">
                        Select a destination folder.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex h-64 flex-col rounded-md border border-border bg-muted/50 p-2">
                    <div className="mb-2 flex items-center gap-2 p-1 text-sm font-medium break-all text-muted-foreground">
                        <Folder className="h-4 w-4 shrink-0 text-primary" />/
                        {destinationPath}
                    </div>

                    <div className="flex-1 space-y-1 overflow-y-auto">
                        {isLoading ? (
                            <div className="flex h-full items-center justify-center">
                                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                            </div>
                        ) : error ? (
                            <div className="p-2 text-center text-sm text-destructive">
                                {error}
                            </div>
                        ) : (
                            <>
                                {destinationPath !== '' && (
                                    <button
                                        type="button"
                                        onClick={navigateUp}
                                        className="flex w-full items-center gap-2 rounded-md p-2 text-sm text-foreground transition-colors hover:bg-muted"
                                    >
                                        <CornerLeftUp className="h-4 w-4 text-muted-foreground" />
                                        <span>...</span>
                                    </button>
                                )}

                                {folders.length === 0 ? (
                                    <div className="p-4 text-center text-sm text-muted-foreground italic">
                                        Empty folder
                                    </div>
                                ) : (
                                    folders.map((folder) => {
                                        const isDisabled =
                                            isFolderInsideSelectedFolder(
                                                folder,
                                            );

                                        return (
                                            <button
                                                key={folder.path}
                                                type="button"
                                                onClick={() =>
                                                    !isDisabled &&
                                                    fetchFolders(folder.path)
                                                }
                                                disabled={isDisabled}
                                                className={`flex w-full items-center justify-between rounded-md p-2 text-sm transition-colors ${
                                                    isDisabled
                                                        ? 'cursor-not-allowed text-muted-foreground opacity-50'
                                                        : 'text-foreground hover:bg-muted'
                                                }`}
                                            >
                                                <div className="flex items-center gap-2">
                                                    <Folder className="h-4 w-4 text-primary" />
                                                    <span className="truncate">
                                                        {folder.name}
                                                    </span>
                                                </div>
                                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                            </button>
                                        );
                                    })
                                )}
                            </>
                        )}
                    </div>
                </div>

                <DialogFooter>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={onClose}
                        disabled={isMoving}
                    >
                        Cancel
                    </Button>
                    <Button
                        type="button"
                        onClick={handleMove}
                        disabled={
                            isLoading || isMoving || !isDestinationValid()
                        }
                        className="bg-primary text-white hover:bg-primary/90"
                    >
                        {isMoving && (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        )}
                        Move Here
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
