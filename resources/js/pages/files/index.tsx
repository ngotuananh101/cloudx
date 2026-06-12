import { Head, router } from '@inertiajs/react';
import { X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { DeleteItemDialog } from '@/components/files/DeleteItemDialog';
import { FileBrowserHeader } from '@/components/files/FileBrowserHeader';
import FilePreviewModal from '@/components/files/FilePreviewModal';
import MoveItemModal from '@/components/files/MoveItemModal';
import ShareItemModal from '@/components/files/ShareItemModal';
import { UploadModeDialog } from '@/components/files/UploadModeDialog';
import { VirtualizedFileTable } from '@/components/files/VirtualizedFileTable';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
    const [folderName, setFolderName] = useState('');
    const [folderError, setFolderError] = useState<string | null>(null);
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

    const createFolder = (event: { preventDefault: () => void }) => {
        event.preventDefault();
        setFolderError(null);

        router.post(
            connections.folders.store({ connection: connection.id }).url,
            {
                path: decodedPath,
                name: folderName,
            },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setFolderName('');
                    setIsCreateFolderOpen(false);
                    refreshFiles();
                },
                onError: (errors) =>
                    setFolderError(errors.name || 'Could not create folder.'),
            },
        );
    };

    const handleClearCache = () => {
        router.delete(clearCache.url({ connection: connection.id }), {
            preserveScroll: true,
            onSuccess: () => refreshFiles(),
        });
    };

    const handleSync = () => {
        router.post(connections.telegram.sync({ connection: connection.id }).url, {}, {
            preserveScroll: true,
            onSuccess: () => refreshFiles(),
        });
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

            {isCreateFolderOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 dark:bg-gray-950/80 px-4">
                    <form
                        onSubmit={createFolder}
                        className="w-full max-w-md rounded-2xl bg-white dark:bg-gray-900 p-6 shadow-xl"
                    >
                        <div className="mb-5 flex items-start justify-between gap-4">
                            <div>
                                <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                                    Create folder
                                </h2>
                                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                    Add a new folder in the current cloud path.
                                </p>
                            </div>
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => setIsCreateFolderOpen(false)}
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                        <Input
                            autoFocus
                            value={folderName}
                            onChange={(event) =>
                                setFolderName(event.target.value)
                            }
                            placeholder="Folder name"
                            className="h-11 rounded-xl"
                        />
                        {folderError && (
                            <p className="mt-2 text-sm text-red-600">
                                {folderError}
                            </p>
                        )}
                        <div className="mt-6 flex justify-end gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setIsCreateFolderOpen(false)}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                className="bg-brand text-white hover:bg-[#a0181e]"
                            >
                                Create
                            </Button>
                        </div>
                    </form>
                </div>
            )}

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

            <style
                dangerouslySetInnerHTML={{
                    __html: `
                .custom-scrollbar::-webkit-scrollbar {
                    width: 14px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background-color: #cbd5e1;
                    border-radius: 20px;
                    border: 4px solid transparent;
                    background-clip: content-box;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background-color: #94a3b8;
                }
                @media (prefers-color-scheme: dark) {
                    .custom-scrollbar::-webkit-scrollbar-thumb {
                        background-color: #475569;
                    }
                    .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                        background-color: #64748b;
                    }
                }
            `,
                }}
            />
        </AuthenticatedLayout>
    );
}
