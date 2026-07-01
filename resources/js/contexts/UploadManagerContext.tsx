import { router, usePage } from '@inertiajs/react';
import { useEcho } from '@laravel/echo-react';
import {
    createContext,
    useCallback,
    useContext,
    useMemo,
    useRef,
    useState,
} from 'react';
import type { ReactNode } from 'react';
import { requestJson } from '@/lib/request-json';
import connections from '@/routes/connections';
import type { User } from '@/types';
import type {
    CloudUploadTask,
    RemoteUploadRequest,
    UploadMode,
    UploadQueueItem,
} from '@/types/cloud';

interface FileBrowserLocation {
    connectionId: number;
    path: string;
}

interface UploadTarget {
    connectionId: number;
    path: string;
    uploadMode?: UploadMode;
}

interface UploadManagerContextValue {
    items: UploadQueueItem[];
    isPanelVisible: boolean;
    enqueue: (files: File[], target: UploadTarget) => void;
    enqueueRemote: (remote: RemoteUploadRequest, target: UploadTarget) => void;
    pause: (item: UploadQueueItem) => Promise<void>;
    resume: (item: UploadQueueItem) => Promise<void>;
    cancel: (item: UploadQueueItem) => Promise<void>;
    retry: (item: UploadQueueItem) => void;
    remove: (item: UploadQueueItem) => void;
    closePanel: () => void;
    registerFileBrowserLocation: (location: FileBrowserLocation | null) => void;
}

const UploadManagerContext = createContext<UploadManagerContextValue | null>(
    null,
);

const getQueueKey = (file: File, target: UploadTarget) =>
    `${target.connectionId}-${target.path}-${file.name}-${file.size}-${file.lastModified}-${target.uploadMode ?? 'backend'}`;

const getRemoteQueueKey = (remote: RemoteUploadRequest, target: UploadTarget) =>
    `${target.connectionId}-${target.path}-${remote.url}-${remote.filename ?? ''}-${Date.now()}`;

export function UploadManagerProvider({ children }: { children: ReactNode }) {
    const [items, setItems] = useState<UploadQueueItem[]>([]);
    const [isPanelVisible, setIsPanelVisible] = useState(false);
    const pausedUploads = useRef(new Set<string>());
    const fileBrowserLocation = useRef<FileBrowserLocation | null>(null);
    const { props } = usePage<{ auth?: { user?: User | null } }>();
    const user = props.auth?.user;

    const updateItem = useCallback(
        (key: string, changes: Partial<UploadQueueItem>) => {
            setItems((currentItems) =>
                currentItems.map((item) =>
                    item.key === key ? { ...item, ...changes } : item,
                ),
            );
        },
        [],
    );

    const refreshFilesIfActive = useCallback((task: CloudUploadTask) => {
        const location = fileBrowserLocation.current;

        if (
            location &&
            location.connectionId === task.connection_id &&
            location.path === task.target_path
        ) {
            router.reload({ only: ['files', 'connection'] });
        }
    }, []);

    const uploadDirectFile = useCallback(
        async (
            key: string,
            file: File,
            target: UploadTarget,
            task: CloudUploadTask,
        ) => {
            const initialized = await requestJson<{
                task: CloudUploadTask;
                multipart: {
                    upload_id: string;
                    key: string;
                    parts: Array<{ ETag: string; PartNumber: number }>;
                };
            }>(
                `/connections/${target.connectionId}/upload-tasks/${task.id}/direct/init`,
                { method: 'POST' },
            );

            let latestTask = initialized.task;
            updateItem(key, { task: latestTask, uploadMode: 'direct' });

            const chunkSize = latestTask.payload.chunk_size;

            for (
                let index = 0;
                index < latestTask.payload.total_chunks;
                index++
            ) {
                if (pausedUploads.current.has(key)) {
                    updateItem(key, { status: 'paused' });

                    return;
                }

                const partNumber = index + 1;
                const part = await requestJson<{ url: string }>(
                    `/connections/${target.connectionId}/upload-tasks/${task.id}/direct/part`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ part_number: partNumber }),
                    },
                );

                const response = await fetch(part.url, {
                    method: 'PUT',
                    body: file.slice(
                        index * chunkSize,
                        Math.min(file.size, (index + 1) * chunkSize),
                    ),
                });

                if (!response.ok) {
                    throw new Error('Direct upload failed.');
                }

                const etag = response.headers.get('etag');

                if (!etag) {
                    throw new Error('Direct upload did not return an ETag.');
                }

                latestTask = await requestJson<CloudUploadTask>(
                    `/connections/${target.connectionId}/upload-tasks/${task.id}/direct/parts/${partNumber}/done`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ etag }),
                    },
                );

                updateItem(key, {
                    task: latestTask,
                    progress: Math.round(
                        (latestTask.payload.uploaded_chunks_count /
                            latestTask.payload.total_chunks) *
                            100,
                    ),
                    status: 'uploading',
                });
            }

            latestTask = await requestJson<CloudUploadTask>(
                `/connections/${target.connectionId}/upload-tasks/${task.id}/direct/complete`,
                { method: 'POST' },
            );

            updateItem(key, {
                task: latestTask,
                progress: 100,
                status: 'queued',
            });
        },
        [updateItem],
    );

    const uploadBackendFile = useCallback(
        async (
            key: string,
            file: File,
            target: UploadTarget,
            task: CloudUploadTask,
        ) => {
            const chunkSize = task.payload.chunk_size;
            const uploadedChunks = new Set(task.uploaded_chunks || []);

            for (let index = 0; index < task.payload.total_chunks; index++) {
                if (pausedUploads.current.has(key)) {
                    updateItem(key, { status: 'paused' });

                    return;
                }

                if (uploadedChunks.has(index)) {
                    continue;
                }

                const formData = new FormData();
                formData.append(
                    'chunk',
                    file.slice(
                        index * chunkSize,
                        Math.min(file.size, (index + 1) * chunkSize),
                    ),
                    file.name,
                );
                formData.append('index', String(index));

                const updatedTask = await requestJson<CloudUploadTask>(
                    connections.uploadTasks.chunks.store({
                        connection: target.connectionId,
                        task: task.id,
                    }).url,
                    {
                        method: 'POST',
                        body: formData,
                    },
                );

                updateItem(key, {
                    task: updatedTask,
                    progress: Math.round(
                        (updatedTask.payload.uploaded_chunks_count /
                            updatedTask.payload.total_chunks) *
                            100,
                    ),
                    status:
                        updatedTask.status_value >= 4 ? 'queued' : 'uploading',
                });
            }

            updateItem(key, { status: 'queued', progress: 100 });
        },
        [updateItem],
    );

    const uploadFile = useCallback(
        async (
            key: string,
            file: File,
            target: UploadTarget,
            existingTask?: CloudUploadTask,
        ) => {
            try {
                updateItem(key, {
                    status: 'uploading',
                    progress: existingTask?.progress ?? 0,
                    error: undefined,
                });

                const uploadMode =
                    target.uploadMode ??
                    existingTask?.payload.upload_mode ??
                    'backend';
                const task =
                    existingTask ||
                    (await requestJson<CloudUploadTask>(
                        connections.uploadTasks.store({
                            connection: target.connectionId,
                        }).url,
                        {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                path: target.path,
                                filename: file.name,
                                mime_type: file.type || null,
                                size: file.size,
                                chunk_size: Math.min(
                                    5 * 1024 * 1024,
                                    Math.max(1024, file.size),
                                ),
                                upload_mode: uploadMode,
                            }),
                        },
                    ));

                updateItem(key, { task, uploadMode });

                if (uploadMode === 'direct') {
                    await uploadDirectFile(key, file, target, task);
                } else {
                    await uploadBackendFile(key, file, target, task);
                }

                refreshFilesIfActive(task);
            } catch (error) {
                updateItem(key, {
                    status: 'failed',
                    error:
                        error instanceof Error
                            ? error.message
                            : 'Upload failed.',
                });
            }
        },
        [refreshFilesIfActive, updateItem, uploadBackendFile, uploadDirectFile],
    );

    const uploadRemoteFile = useCallback(
        async (
            key: string,
            remote: RemoteUploadRequest,
            target: UploadTarget,
        ) => {
            try {
                updateItem(key, {
                    status: 'queued',
                    progress: 0,
                    error: undefined,
                });

                const task = await requestJson<CloudUploadTask>(
                    connections.uploadTasks.store({
                        connection: target.connectionId,
                    }).url,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            path: target.path,
                            filename: remote.filename || null,
                            url: remote.url,
                            headers: remote.headers,
                            upload_mode: 'remote',
                        }),
                    },
                );

                updateItem(key, {
                    task,
                    uploadMode: 'remote',
                    status: task.status,
                    progress: task.progress,
                });
            } catch (error) {
                updateItem(key, {
                    status: 'failed',
                    error:
                        error instanceof Error
                            ? error.message
                            : 'Remote upload failed.',
                });
            }
        },
        [updateItem],
    );

    const enqueue = useCallback(
        (files: File[], target: UploadTarget) => {
            const queueItems = files.map((file) => ({
                key: getQueueKey(file, target),
                file,
                source: 'local' as const,
                connectionId: target.connectionId,
                path: target.path,
                uploadMode: target.uploadMode,
                progress: 0,
                status: 'pending' as const,
            }));

            setItems((currentItems) => [...queueItems, ...currentItems]);
            setIsPanelVisible(true);
            queueItems.forEach(
                (item) => void uploadFile(item.key, item.file, target),
            );
        },
        [uploadFile],
    );

    const enqueueRemote = useCallback(
        (remote: RemoteUploadRequest, target: UploadTarget) => {
            const item = {
                key: getRemoteQueueKey(remote, target),
                source: 'remote' as const,
                remote,
                connectionId: target.connectionId,
                path: target.path,
                uploadMode: 'remote' as const,
                progress: 0,
                status: 'pending' as const,
            };

            setItems((currentItems) => [item, ...currentItems]);
            setIsPanelVisible(true);
            void uploadRemoteFile(item.key, remote, target);
        },
        [uploadRemoteFile],
    );

    const pause = useCallback(
        async (item: UploadQueueItem) => {
            pausedUploads.current.add(item.key);

            if (item.task) {
                await requestJson<CloudUploadTask>(
                    connections.uploadTasks.pause({
                        connection: item.connectionId,
                        task: item.task.id,
                    }).url,
                    { method: 'PATCH' },
                );
            }

            updateItem(item.key, { status: 'paused' });
        },
        [updateItem],
    );

    const resume = useCallback(
        async (item: UploadQueueItem) => {
            if (!item.task) {
                return;
            }

            pausedUploads.current.delete(item.key);
            const task = await requestJson<CloudUploadTask>(
                connections.uploadTasks.resume({
                    connection: item.connectionId,
                    task: item.task.id,
                }).url,
                { method: 'PATCH' },
            );
            updateItem(item.key, { task, status: 'uploading' });

            if (item.source === 'remote' && item.remote) {
                void uploadRemoteFile(item.key, item.remote, {
                    connectionId: item.connectionId,
                    path: item.path,
                    uploadMode: 'remote',
                });

                return;
            }

            if (!item.file) {
                return;
            }

            void uploadFile(
                item.key,
                item.file,
                {
                    connectionId: item.connectionId,
                    path: item.path,
                    uploadMode: item.uploadMode,
                },
                task,
            );
        },
        [updateItem, uploadFile, uploadRemoteFile],
    );

    const cancel = useCallback(
        async (item: UploadQueueItem) => {
            pausedUploads.current.add(item.key);

            if (item.task) {
                if (item.uploadMode === 'direct') {
                    await requestJson<CloudUploadTask>(
                        `/connections/${item.connectionId}/upload-tasks/${item.task.id}/direct/abort`,
                        { method: 'DELETE' },
                    );
                } else {
                    await requestJson<CloudUploadTask>(
                        connections.uploadTasks.destroy({
                            connection: item.connectionId,
                            task: item.task.id,
                        }).url,
                        { method: 'DELETE' },
                    );
                }
            }

            updateItem(item.key, { status: 'cancelled' });
        },
        [updateItem],
    );

    const retry = useCallback(
        (item: UploadQueueItem) => {
            pausedUploads.current.delete(item.key);

            if (item.source === 'remote' && item.remote) {
                void uploadRemoteFile(item.key, item.remote, {
                    connectionId: item.connectionId,
                    path: item.path,
                    uploadMode: 'remote',
                });

                return;
            }

            if (!item.file) {
                return;
            }

            void uploadFile(
                item.key,
                item.file,
                {
                    connectionId: item.connectionId,
                    path: item.path,
                    uploadMode: item.uploadMode,
                },
                undefined,
            );
        },
        [uploadFile, uploadRemoteFile],
    );

    const closePanel = useCallback(() => setIsPanelVisible(false), []);

    const remove = useCallback((item: UploadQueueItem) => {
        setItems((currentItems) =>
            currentItems.filter((i) => i.key !== item.key),
        );

        setItems((currentItems) => {
            if (currentItems.length === 0) {
                setIsPanelVisible(false);
            }

            return currentItems;
        });
    }, []);

    const registerFileBrowserLocation = useCallback(
        (location: FileBrowserLocation | null) => {
            fileBrowserLocation.current = location;
        },
        [],
    );

    const mergeBroadcastTask = useCallback(
        (task: CloudUploadTask) => {
            setItems((currentItems) =>
                currentItems.map((item) =>
                    item.task?.id === task.id
                        ? {
                              ...item,
                              task,
                              progress: task.progress,
                              status: task.status,
                              error: task.error_message || undefined,
                          }
                        : item,
                ),
            );

            if (task.status === 'completed') {
                refreshFilesIfActive(task);
            }
        },
        [refreshFilesIfActive],
    );

    const value = useMemo(
        () => ({
            items,
            isPanelVisible,
            enqueue,
            enqueueRemote,
            pause,
            resume,
            cancel,
            retry,
            remove,
            closePanel,
            registerFileBrowserLocation,
        }),
        [
            items,
            isPanelVisible,
            enqueue,
            enqueueRemote,
            pause,
            resume,
            cancel,
            retry,
            remove,
            closePanel,
            registerFileBrowserLocation,
        ],
    );

    return (
        <UploadManagerContext.Provider value={value}>
            {user?.id ? (
                <CloudTaskBroadcastListener
                    userId={user.id}
                    onUpdate={mergeBroadcastTask}
                />
            ) : null}
            {children}
        </UploadManagerContext.Provider>
    );
}

function CloudTaskBroadcastListener({
    userId,
    onUpdate,
}: {
    userId: number;
    onUpdate: (task: CloudUploadTask) => void;
}) {
    useEcho<CloudUploadTask>(
        `users.${userId}.cloud-tasks`,
        '.CloudUploadTaskUpdated',
        onUpdate,
    );

    return null;
}

export function useUploadManager() {
    const context = useContext(UploadManagerContext);

    if (!context) {
        throw new Error(
            'useUploadManager must be used within an UploadManagerProvider.',
        );
    }

    return context;
}
