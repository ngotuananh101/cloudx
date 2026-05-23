import { Head, router } from '@inertiajs/react';
import { useMemo, useState } from 'react';
import { FileBrowserHeader } from '@/components/files/FileBrowserHeader';
import { FileToolbar } from '@/components/files/FileToolbar';
import { VirtualizedFileTable } from '@/components/files/VirtualizedFileTable';
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout';
import { encodeCloudPath } from '@/lib/cloud-path';
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
        router.visit(`/s/${connection.id}/${encodedPath}`);
    };

    const handleNavigateHome = () => {
        router.visit(`/s/${connection.id}`);
    };

    return (
        <AuthenticatedLayout title="Files">
            <Head title="Files & Folders" />

            <FileBrowserHeader connection={connection} decodedPath={decodedPath} onNavigateHome={handleNavigateHome} />

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
