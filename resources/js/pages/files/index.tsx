import { Head, router } from '@inertiajs/react';
import { useMemo, useState } from 'react';
import { FileBrowserHeader } from '@/components/files/FileBrowserHeader';
import { FileToolbar } from '@/components/files/FileToolbar';
import { StorageQuotaPanel } from '@/components/files/StorageQuotaPanel';
import { VirtualizedFileTable } from '@/components/files/VirtualizedFileTable';
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout';
import { encodeCloudPath } from '@/lib/cloud-path';
import { index as storageIndex } from '@/routes/storage';
import type { CloudConnection, CloudFile } from '@/types/cloud';

interface FileBrowserProps {
    connection: CloudConnection;
    decodedPath: string;
    files: CloudFile[];
}

export default function FileBrowser({ connection, decodedPath, files }: FileBrowserProps) {
    const [searchQuery, setSearchQuery] = useState('');

    const filteredFiles = useMemo(() => {
        if (!searchQuery) {
            return files || [];
        }

        return (files || []).filter((file) => file.name.toLowerCase().includes(searchQuery.toLowerCase()));
    }, [files, searchQuery]);

    const handleNavigate = (file: CloudFile) => {
        if (!file.isDirectory) {
            return;
        }

        const encodedPath = encodeCloudPath(file.path);
        router.visit(storageIndex.url({ connection: connection.id, path: encodedPath }));
    };

    const handleNavigateHome = () => {
        router.visit(storageIndex.url({ connection: connection.id }));
    };

    return (
        <AuthenticatedLayout title="Files">
            <Head title="Files & Folders" />

            <FileBrowserHeader connection={connection} decodedPath={decodedPath} onNavigateHome={handleNavigateHome} />

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
                <div className="min-w-0 space-y-4">
                    <FileToolbar
                        decodedPath={decodedPath}
                        searchQuery={searchQuery}
                        setSearchQuery={setSearchQuery}
                        capabilities={connection.capabilities}
                    />

                    <VirtualizedFileTable
                        files={filteredFiles}
                        searchQuery={searchQuery}
                        capabilities={connection.capabilities}
                        onNavigate={handleNavigate}
                    />
                </div>

                <StorageQuotaPanel connection={connection} currentPath={decodedPath} />
            </div>

            <style dangerouslySetInnerHTML={{__html: `
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
            `}} />
        </AuthenticatedLayout>
    );
}
