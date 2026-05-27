import { Head, router } from '@inertiajs/react';
import { Pause, Play, X } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { FileBrowserHeader } from '@/components/files/FileBrowserHeader';
import { VirtualizedFileTable } from '@/components/files/VirtualizedFileTable';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout';
import { encodeCloudPath } from '@/lib/cloud-path';
import connections from '@/routes/connections';
import { index as storageIndex } from '@/routes/storage';
import type { CloudConnection, CloudFile } from '@/types/cloud';

interface FileBrowserProps {
    connection: CloudConnection;
    decodedPath: string;
    files: CloudFile[];
}

interface UploadTask {
    id: number;
    name: string;
    status: string;
    status_value: number;
    payload: {
        chunk_size: number;
        total_chunks: number;
        uploaded_chunks_count: number;
    };
    uploaded_chunks: number[];
}

interface UploadQueueItem {
    key: string;
    file: File;
    task?: UploadTask;
    progress: number;
    status: 'pending' | 'uploading' | 'paused' | 'queued' | 'completed' | 'failed' | 'cancelled';
    error?: string;
}

const csrfToken = () => {
    const cookie = document.cookie
        .split('; ')
        .find((row) => row.startsWith('XSRF-TOKEN='))
        ?.split('=')[1];

    return cookie ? decodeURIComponent(cookie) : '';
};

const requestJson = async <T,>(url: string, options: RequestInit = {}): Promise<T> => {
    const response = await fetch(url, {
        ...options,
        headers: {
            Accept: 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
            'X-XSRF-TOKEN': csrfToken(),
            ...(options.headers || {}),
        },
    });

    if (!response.ok) {
        const payload = await response.json().catch(() => null);

        throw new Error(payload?.message || 'Request failed.');
    }

    return response.json();
};

export default function FileBrowser({ connection, decodedPath, files }: FileBrowserProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
    const [folderName, setFolderName] = useState('');
    const [folderError, setFolderError] = useState<string | null>(null);
    const [uploadQueue, setUploadQueue] = useState<UploadQueueItem[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const pausedUploads = useRef(new Set<string>());

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

    const updateUploadItem = (key: string, changes: Partial<UploadQueueItem>) => {
        setUploadQueue((items) => items.map((item) => (item.key === key ? { ...item, ...changes } : item)));
    };

    const refreshFiles = () => {
        router.reload({ only: ['files', 'connection'] });
    };

    const uploadFile = async (key: string, file: File, existingTask?: UploadTask) => {
        try {
            updateUploadItem(key, { status: 'uploading', progress: 0, error: undefined });

            const task = existingTask || await requestJson<UploadTask>(connections.uploadTasks.store({ connection: connection.id }).url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    path: decodedPath,
                    filename: file.name,
                    mime_type: file.type || null,
                    size: file.size,
                    chunk_size: Math.min(5 * 1024 * 1024, Math.max(1024, file.size)),
                }),
            });

            updateUploadItem(key, { task });

            const chunkSize = task.payload.chunk_size;
            const uploadedChunks = new Set(task.uploaded_chunks || []);

            for (let index = 0; index < task.payload.total_chunks; index++) {
                if (pausedUploads.current.has(key)) {
                    updateUploadItem(key, { status: 'paused' });

                    return;
                }

                if (uploadedChunks.has(index)) {
                    continue;
                }

                const formData = new FormData();
                formData.append('chunk', file.slice(index * chunkSize, Math.min(file.size, (index + 1) * chunkSize)), file.name);
                formData.append('index', String(index));

                const updatedTask = await requestJson<UploadTask>(connections.uploadTasks.chunks.store({ connection: connection.id, task: task.id }).url, {
                    method: 'POST',
                    body: formData,
                });

                updateUploadItem(key, {
                    task: updatedTask,
                    progress: Math.round((updatedTask.payload.uploaded_chunks_count / updatedTask.payload.total_chunks) * 100),
                    status: updatedTask.status_value >= 4 ? 'queued' : 'uploading',
                });
            }

            updateUploadItem(key, { status: 'queued', progress: 100 });
            refreshFiles();
        } catch (error) {
            updateUploadItem(key, { status: 'failed', error: error instanceof Error ? error.message : 'Upload failed.' });
        }
    };

    const handleUploadFiles = (event: ChangeEvent<HTMLInputElement>) => {
        const selectedFiles = Array.from(event.target.files || []);
        event.target.value = '';

        if (selectedFiles.length === 0) {
            return;
        }

        const queueItems = selectedFiles.map((file) => ({
            key: `${file.name}-${file.size}-${file.lastModified}`,
            file,
            progress: 0,
            status: 'pending' as const,
        }));

        setUploadQueue((items) => [...queueItems, ...items]);
        queueItems.forEach((item) => void uploadFile(item.key, item.file));
    };

    const pauseUpload = async (item: UploadQueueItem) => {
        pausedUploads.current.add(item.key);

        if (item.task) {
            await requestJson<UploadTask>(connections.uploadTasks.pause({ connection: connection.id, task: item.task.id }).url, { method: 'PATCH' });
        }

        updateUploadItem(item.key, { status: 'paused' });
    };

    const resumeUpload = async (item: UploadQueueItem) => {
        if (!item.task) {
            return;
        }

        pausedUploads.current.delete(item.key);
        const task = await requestJson<UploadTask>(connections.uploadTasks.resume({ connection: connection.id, task: item.task.id }).url, { method: 'PATCH' });
        updateUploadItem(item.key, { task, status: 'uploading' });
        void uploadFile(item.key, item.file, task);
    };

    const cancelUpload = async (item: UploadQueueItem) => {
        pausedUploads.current.add(item.key);

        if (item.task) {
            await requestJson<UploadTask>(connections.uploadTasks.destroy({ connection: connection.id, task: item.task.id }).url, { method: 'DELETE' });
        }

        updateUploadItem(item.key, { status: 'cancelled' });
    };

    const createFolder = (event: { preventDefault: () => void }) => {
        event.preventDefault();
        setFolderError(null);

        router.post(connections.folders.store({ connection: connection.id }).url, {
            path: decodedPath,
            name: folderName,
        }, {
            preserveScroll: true,
            onSuccess: () => {
                setFolderName('');
                setIsCreateFolderOpen(false);
                refreshFiles();
            },
            onError: (errors) => setFolderError(errors.name || 'Could not create folder.'),
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
            }}
        >
            <Head title="Files & Folders" />

            <FileBrowserHeader connection={connection} decodedPath={decodedPath} onNavigateHome={handleNavigateHome} />

            <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleUploadFiles} />

            {isCreateFolderOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
                    <form onSubmit={createFolder} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
                        <div className="mb-5 flex items-start justify-between gap-4">
                            <div>
                                <h2 className="text-lg font-bold text-gray-900">Create folder</h2>
                                <p className="mt-1 text-sm font-medium text-gray-500">Add a new folder in the current cloud path.</p>
                            </div>
                            <Button type="button" variant="ghost" size="icon" onClick={() => setIsCreateFolderOpen(false)}>
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                        <Input
                            autoFocus
                            value={folderName}
                            onChange={(event) => setFolderName(event.target.value)}
                            placeholder="Folder name"
                            className="h-11 rounded-xl"
                        />
                        {folderError && <p className="mt-2 text-sm font-semibold text-red-600">{folderError}</p>}
                        <div className="mt-6 flex justify-end gap-2">
                            <Button type="button" variant="outline" onClick={() => setIsCreateFolderOpen(false)}>
                                Cancel
                            </Button>
                            <Button type="submit" className="bg-brand text-white hover:bg-[#a0181e]">
                                Create
                            </Button>
                        </div>
                    </form>
                </div>
            )}

            {uploadQueue.length > 0 && (
                <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                    <div className="mb-3 text-xs font-black tracking-widest text-gray-400">UPLOAD QUEUE</div>
                    <div className="space-y-3">
                        {uploadQueue.map((item) => (
                            <div key={item.key} className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0 flex-1">
                                        <div className="truncate text-sm font-bold text-gray-900">{item.file.name}</div>
                                        <div className="mt-1 text-xs font-semibold text-gray-500">{item.status}</div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        {item.status === 'uploading' && (
                                            <Button type="button" variant="ghost" size="icon-sm" onClick={() => void pauseUpload(item)}>
                                                <Pause className="h-4 w-4" />
                                            </Button>
                                        )}
                                        {item.status === 'paused' && (
                                            <Button type="button" variant="ghost" size="icon-sm" onClick={() => void resumeUpload(item)}>
                                                <Play className="h-4 w-4" />
                                            </Button>
                                        )}
                                        {!['completed', 'cancelled'].includes(item.status) && (
                                            <Button type="button" variant="ghost" size="icon-sm" onClick={() => void cancelUpload(item)}>
                                                <X className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </div>
                                </div>
                                <Progress value={item.progress} className="mt-3 h-2 bg-gray-200 [&>div]:bg-brand" />
                                {item.error && <p className="mt-2 text-xs font-semibold text-red-600">{item.error}</p>}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 gap-6">
                <div className="min-w-0 space-y-4">
                    <VirtualizedFileTable
                        files={filteredFiles}
                        searchQuery={searchQuery}
                        capabilities={connection.capabilities}
                        onNavigate={handleNavigate}
                    />
                </div>
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
