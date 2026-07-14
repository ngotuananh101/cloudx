import { Head, router } from '@inertiajs/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { BulkFileActionsBar } from '@/components/files/BulkFileActionsBar';
import { CreateFolderDialog } from '@/components/files/CreateFolderDialog';
import { DeleteItemDialog } from '@/components/files/DeleteItemDialog';
import { FileBrowserHeader } from '@/components/files/FileBrowserHeader';
import FilePreviewModal from '@/components/files/FilePreviewModal';
import MoveItemModal from '@/components/files/MoveItemModal';
import { RemoteUploadDialog } from '@/components/files/RemoteUploadDialog';
import ShareItemModal from '@/components/files/ShareItemModal';
import { UploadModeDialog } from '@/components/files/UploadModeDialog';
import { VirtualizedFileTable } from '@/components/files/VirtualizedFileTable';
import { useUploadManager } from '@/contexts/UploadManagerContext';
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout';
import { encodeCloudPath } from '@/lib/cloud-path';
import { destroy as clearCache } from '@/routes/cloud-connections/cache';
import connections from '@/routes/connections';
import { index as storageIndex } from '@/routes/storage';
import type {
    CloudConnection,
    CloudFile,
    RemoteUploadRequest,
    UploadMode,
} from '@/types/cloud';

interface FileBrowserProps {
    connection: CloudConnection;
    decodedPath: string;
    files: CloudFile[];
}

export default function FileBrowser({
    connection,
    decodedPath,
    files,
}: Readonly<FileBrowserProps>) {
    const [searchQuery, setSearchQuery] = useState('');
    const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
    const [itemsToDelete, setItemsToDelete] = useState<CloudFile[]>([]);
    const [previewItem, setPreviewItem] = useState<CloudFile | null>(null);
    const [itemsToMove, setItemsToMove] = useState<CloudFile[]>([]);
    const [itemToShare, setItemToShare] = useState<CloudFile | null>(null);
    const [selectedPaths, setSelectedPaths] = useState<Set<string>>(
        () => new Set(),
    );
    const [pendingUploadFiles, setPendingUploadFiles] = useState<File[]>([]);
    const [isUploadModeDialogOpen, setIsUploadModeDialogOpen] = useState(false);
    const [isRemoteUploadDialogOpen, setIsRemoteUploadDialogOpen] =
        useState(false);
    const uploadManager = useUploadManager();
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        uploadManager.registerFileBrowserLocation({
            connectionId: connection.id,
            path: decodedPath,
        });

        return () => uploadManager.registerFileBrowserLocation(null);
    }, [connection.id, decodedPath, uploadManager]);

    const filteredFiles = useMemo(() => {
        if (!searchQuery) {
            return files || [];
        }

        return (files || []).filter((file) =>
            file.name.toLowerCase().includes(searchQuery.toLowerCase()),
        );
    }, [files, searchQuery]);

    const selectedItems = useMemo(
        () => filteredFiles.filter((file) => selectedPaths.has(file.path)),
        [filteredFiles, selectedPaths],
    );

    const isAllSelected =
        filteredFiles.length > 0 &&
        filteredFiles.every((file) => selectedPaths.has(file.path));
    const isPartiallySelected = selectedItems.length > 0 && !isAllSelected;

    const clearSelection = () => {
        setSelectedPaths(new Set());
    };

    const handleSearchChange = (value: string) => {
        setSearchQuery(value);
        clearSelection();
    };

    const handleToggleSelection = (file: CloudFile, selected: boolean) => {
        setSelectedPaths((currentPaths) => {
            const nextPaths = new Set(currentPaths);

            if (selected) {
                nextPaths.add(file.path);
            } else {
                nextPaths.delete(file.path);
            }

            return nextPaths;
        });
    };

    const handleToggleSelectAll = (selected: boolean) => {
        setSelectedPaths((currentPaths) => {
            const nextPaths = new Set(currentPaths);

            filteredFiles.forEach((file) => {
                if (selected) {
                    nextPaths.add(file.path);
                } else {
                    nextPaths.delete(file.path);
                }
            });

            return nextPaths;
        });
    };

    const handleNavigate = (file: Readonly<CloudFile>) => {
        if (!file.isDirectory) {
            return;
        }

        const encodedPath = encodeCloudPath(file.path);
        clearSelection();
        router.visit(
            storageIndex.url({ connection: connection.id, path: encodedPath }),
        );
    };

    const handleNavigateHome = () => {
        clearSelection();
        router.visit(storageIndex.url({ connection: connection.id }));
    };

    const handleNavigatePath = (path: string) => {
        const encodedPath = encodeCloudPath(path);
        clearSelection();

        router.visit(
            storageIndex.url({ connection: connection.id, path: encodedPath }),
        );
    };

    const refreshFiles = () => {
        router.reload({ only: ['files', 'connection'] });
    };

    const handleUploadFiles = (event: Readonly<ChangeEvent<HTMLInputElement>>) => {
        const selectedFiles = Array.from(event.target.files || []);
        event.target.value = '';

        if (selectedFiles.length === 0) {
            return;
        }

        setPendingUploadFiles(selectedFiles);

        // provider is the enum integer value (4 = AWS_S3)
        if (connection.provider === 4) {
            setIsUploadModeDialogOpen(true);
        } else {
            uploadManager.enqueue(selectedFiles, {
                connectionId: connection.id,
                path: decodedPath,
                uploadMode: 'backend',
            });
            setPendingUploadFiles([]);
        }
    };

    const handleUploadModeSelect = (mode: Readonly<UploadMode>) => {
        uploadManager.enqueue(pendingUploadFiles, {
            connectionId: connection.id,
            path: decodedPath,
            uploadMode: mode,
        });
        setPendingUploadFiles([]);
        setIsUploadModeDialogOpen(false);
    };

    const handleRemoteUpload = (remoteUpload: Readonly<RemoteUploadRequest>) => {
        uploadManager.enqueueRemote(remoteUpload, {
            connectionId: connection.id,
            path: decodedPath,
            uploadMode: 'remote',
        });
    };

    const handleCreateFolder = async (name: string): Promise<string | null> => {
        return new Promise((resolve) => {
            router.post(
                connections.folders.store({ connection: connection.id }).url,
                {
                    path: decodedPath,
                    name,
                },
                {
                    preserveScroll: true,
                    onSuccess: () => {
                        refreshFiles();
                        resolve(null);
                    },
                    onError: (errors) =>
                        resolve(errors.name || 'Could not create folder.'),
                },
            );
        });
    };

    const handleClearCache = () => {
        router.delete(clearCache.url({ connection: connection.id }), {
            preserveScroll: true,
            onSuccess: () => refreshFiles(),
        });
    };

    const handleSync = () => {
        router.post(
            connections.telegram.sync({ connection: connection.id }).url,
            {},
            {
                preserveScroll: true,
                onSuccess: () => refreshFiles(),
            },
        );
    };

    return (
        <AuthenticatedLayout
            title="Files"
            cloudSearch={{
                value: searchQuery,
                onChange: handleSearchChange,
                placeholder: `Search in ${decodedPath ? decodedPath.split('/').pop() : 'My Files'}...`,
            }}
            cloudActions={{
                canCreateFolder: connection.capabilities?.createFolder,
                canUpload: connection.capabilities?.upload,
                onCreateFolder: () => setIsCreateFolderOpen(true),
                onUpload: () => fileInputRef.current?.click(),
                onRemoteUpload: () => setIsRemoteUploadDialogOpen(true),
                onClearCache: handleClearCache,
                onSync: handleSync,
            }}
        >
            <Head title="Files & Folders" />

            <FileBrowserHeader
                connection={connection}
                decodedPath={decodedPath}
                onNavigateHome={handleNavigateHome}
                onNavigatePath={handleNavigatePath}
            />

            <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleUploadFiles}
            />

            <DeleteItemDialog
                items={itemsToDelete}
                connectionId={connection.id}
                onClose={() => setItemsToDelete([])}
                onDeleted={() => {
                    clearSelection();
                    refreshFiles();
                }}
            />

            <FilePreviewModal
                item={previewItem}
                connectionId={connection.id}
                onClose={() => setPreviewItem(null)}
            />

            <MoveItemModal
                isOpen={itemsToMove.length > 0}
                onClose={() => setItemsToMove([])}
                items={itemsToMove}
                connectionId={connection.id}
                currentParentPath={decodedPath}
                onMoved={() => {
                    clearSelection();
                    refreshFiles();
                }}
            />

            <ShareItemModal
                isOpen={!!itemToShare}
                onClose={() => setItemToShare(null)}
                item={itemToShare}
                connectionId={connection.id}
            />

            <CreateFolderDialog
                isOpen={isCreateFolderOpen}
                onClose={() => setIsCreateFolderOpen(false)}
                onCreate={handleCreateFolder}
            />

            <UploadModeDialog
                isOpen={isUploadModeDialogOpen}
                onClose={() => {
                    setIsUploadModeDialogOpen(false);
                    setPendingUploadFiles([]);
                }}
                onSelect={handleUploadModeSelect}
            />

            <RemoteUploadDialog
                isOpen={isRemoteUploadDialogOpen}
                onClose={() => setIsRemoteUploadDialogOpen(false)}
                onSubmit={handleRemoteUpload}
            />

            <div className="grid grid-cols-1 gap-6">
                <div className="flex h-[calc(100vh-180px)] min-w-0 flex-col gap-4">
                    <BulkFileActionsBar
                        selectedCount={selectedItems.length}
                        canDelete={connection.capabilities?.delete}
                        canMove={connection.capabilities?.move}
                        onDelete={() => setItemsToDelete(selectedItems)}
                        onMove={() => setItemsToMove(selectedItems)}
                        onClear={clearSelection}
                    />

                    <div className="min-h-0 flex-1">
                        <VirtualizedFileTable
                            files={filteredFiles}
                            searchQuery={searchQuery}
                            capabilities={connection.capabilities}
                            onNavigate={handleNavigate}
                            onDelete={(item) => setItemsToDelete([item])}
                            onPreview={setPreviewItem}
                            onMove={(item) => setItemsToMove([item])}
                            onShare={setItemToShare}
                            selectedPaths={selectedPaths}
                            isAllSelected={isAllSelected}
                            isPartiallySelected={isPartiallySelected}
                            onToggleSelection={handleToggleSelection}
                            onToggleSelectAll={handleToggleSelectAll}
                            connectionId={connection.id}
                        />
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
