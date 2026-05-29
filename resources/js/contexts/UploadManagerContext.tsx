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
import type { CloudUploadTask, UploadQueueItem } from '@/types/cloud';
import type { User } from '@/types';

interface FileBrowserLocation {
    connectionId: number;
    path: string;
}

interface UploadTarget {
    connectionId: number;
    path: string;
}

interface UploadManagerContextValue {
    items: UploadQueueItem[];
    isPanelVisible: boolean;
    enqueue: (files: File[], target: UploadTarget) => void;
    pause: (item: UploadQueueItem) => Promise<void>;
    resume: (item: UploadQueueItem) => Promise<void>;
    cancel: (item: UploadQueueItem) => Promise<void>;
    retry: (item: UploadQueueItem) => void;
    closePanel: () => void;
    registerFileBrowserLocation: (location: FileBrowserLocation | null) => void;
}

const UploadManagerContext = createContext<UploadManagerContextValue | null>(
    null,
);

const getQueueKey = (file: File, target: UploadTarget) =>
    `${target.connectionId}-${target.path}-${file.name}-${file.size}-${file.lastModified}`;

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
                            }),
                        },
                    ));

                updateItem(key, { task });

                const chunkSize = task.payload.chunk_size;
                const uploadedChunks = new Set(task.uploaded_chunks || []);

                for (
                    let index = 0;
                    index < task.payload.total_chunks;
                    index++
                ) {
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
                            updatedTask.status_value >= 4
                                ? 'queued'
                                : 'uploading',
                    });
                }

                updateItem(key, { status: 'queued', progress: 100 });
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
        [refreshFilesIfActive, updateItem],
    );

    const enqueue = useCallback(
        (files: File[], target: UploadTarget) => {
            const queueItems = files.map((file) => ({
                key: getQueueKey(file, target),
                file,
                connectionId: target.connectionId,
                path: target.path,
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
            void uploadFile(
                item.key,
                item.file,
                { connectionId: item.connectionId, path: item.path },
                task,
            );
        },
        [updateItem, uploadFile],
    );

    const cancel = useCallback(
        async (item: UploadQueueItem) => {
            pausedUploads.current.add(item.key);

            if (item.task) {
                await requestJson<CloudUploadTask>(
                    connections.uploadTasks.destroy({
                        connection: item.connectionId,
                        task: item.task.id,
                    }).url,
                    { method: 'DELETE' },
                );
            }

            updateItem(item.key, { status: 'cancelled' });
        },
        [updateItem],
    );

    const retry = useCallback(
        (item: UploadQueueItem) => {
            pausedUploads.current.delete(item.key);
            void uploadFile(
                item.key,
                item.file,
                { connectionId: item.connectionId, path: item.path },
                item.task,
            );
        },
        [uploadFile],
    );

    const closePanel = useCallback(() => setIsPanelVisible(false), []);

    const registerFileBrowserLocation = useCallback(
        (location: FileBrowserLocation | null) => {
            fileBrowserLocation.current = location;
        },
        [],
    );

    const channel = user?.id ? `users.${user.id}.cloud-tasks` : null;

    useEcho<CloudUploadTask>(
        channel,
        '.CloudUploadTaskUpdated',
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
    );

    const value = useMemo(
        () => ({
            items,
            isPanelVisible,
            enqueue,
            pause,
            resume,
            cancel,
            retry,
            closePanel,
            registerFileBrowserLocation,
        }),
        [
            items,
            isPanelVisible,
            enqueue,
            pause,
            resume,
            cancel,
            retry,
            closePanel,
            registerFileBrowserLocation,
        ],
    );

    return (
        <UploadManagerContext.Provider value={value}>
            {children}
        </UploadManagerContext.Provider>
    );
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
