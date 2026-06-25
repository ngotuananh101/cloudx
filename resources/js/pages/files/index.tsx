import { Head, router } from '@inertiajs/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { CreateFolderDialog } from '@/components/files/CreateFolderDialog';
import { DeleteItemDialog } from '@/components/files/DeleteItemDialog';
import { FileBrowserHeader } from '@/components/files/FileBrowserHeader';
import FilePreviewModal from '@/components/files/FilePreviewModal';
import MoveItemModal from '@/components/files/MoveItemModal';
import ShareItemModal from '@/components/files/ShareItemModal';
import { UploadModeDialog } from '@/components/files/UploadModeDialog';
import { VirtualizedFileTable } from '@/components/files/VirtualizedFileTable';
import { useUploadManager } from '@/contexts/UploadManagerContext';
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout';
import { encodeCloudPath } from '@/lib/cloud-path';
import { destroy as clearCache } from '@/routes/cloud-connections/cache';
import connections from '@/routes/connections';
import { index as storageIndex } from '@/routes/storage';
import type { CloudConnection, CloudFile, UploadMode } from '@/types/cloud';

interface FileBrowserProps {
    connection: CloudConnection;
    decodedPath: string;
    files: CloudFile[];
}

export default function FileBrowser({
    connection,
    decodedPath,
    files,
}: FileBrowserProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<CloudFile | null>(null);
    const [previewItem, setPreviewItem] = useState<CloudFile | null>(null);
    const [itemToMove, setItemToMove] = useState<CloudFile | null>(null);
    const [itemToShare, setItemToShare] = useState<CloudFile | null>(null);
    const [pendingUploadFiles, setPendingUploadFiles] = useState<File[]>([]);
    const [isUploadModeDialogOpen, setIsUploadModeDialogOpen] = useState(false);
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

    const handleNavigate = (file: CloudFile) => {
        if (!file.isDirectory) {
            return;
        }

        const encodedPath = encodeCloudPath(file.path);
        router.visit(
            storageIndex.url({ connection: connection.id, path: encodedPath }),
        );
    };

    const handleNavigateHome = () => {
        router.visit(storageIndex.url({ connection: connection.id }));
    };

    const handleNavigatePath = (path: string) => {
        const encodedPath = encodeCloudPath(path);

        router.visit(
            storageIndex.url({ connection: connection.id, path: encodedPath }),
        );
    };

    const refreshFiles = () => {
        router.reload({ only: ['files', 'connection'] });
    };

    const handleUploadFiles = (event: ChangeEvent<HTMLInputElement>) => {
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

    const handleUploadModeSelect = (mode: UploadMode) => {
        uploadManager.enqueue(pendingUploadFiles, {
            connectionId: connection.id,
            path: decodedPath,
            uploadMode: mode,
        });
        setPendingUploadFiles([]);
        setIsUploadModeDialogOpen(false);
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
                onChange: setSearchQuery,
                placeholder: `Search in ${decodedPath ? decodedPath.split('/').pop() : 'My Files'}...`,
            }}
            cloudActions={{
                canCreateFolder: connection.capabilities?.createFolder,
                canUpload: connection.capabilities?.upload,
                onCreateFolder: () => setIsCreateFolderOpen(true),
                onUpload: () => fileInputRef.current?.click(),
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
                item={itemToDelete}
                connectionId={connection.id}
                onClose={() => setItemToDelete(null)}
                onDeleted={refreshFiles}
            />

            <FilePreviewModal
                item={previewItem}
                connectionId={connection.id}
                onClose={() => setPreviewItem(null)}
            />

            <MoveItemModal
                isOpen={!!itemToMove}
                onClose={() => setItemToMove(null)}
                item={itemToMove}
                connectionId={connection.id}
                currentParentPath={decodedPath}
                onMoved={refreshFiles}
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

            <div className="grid grid-cols-1 gap-6">
                <div className="min-w-0 space-y-4">
                    <VirtualizedFileTable
                        files={filteredFiles}
                        searchQuery={searchQuery}
                        capabilities={connection.capabilities}
                        onNavigate={handleNavigate}
                        onDelete={setItemToDelete}
                        onPreview={setPreviewItem}
                        onMove={setItemToMove}
                        onShare={setItemToShare}
                        connectionId={connection.id}
                    />
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
