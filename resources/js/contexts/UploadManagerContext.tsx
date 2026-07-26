import { router, usePage } from '@inertiajs/react';
import { useEcho } from '@laravel/echo-react';
import {
    createContext,
    useCallback,
    useContext,
    useEffect,
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

export const UploadManagerStateContext = createContext<{
    items: UploadQueueItem[];
    isPanelVisible: boolean;
} | null>(null);

export const UploadManagerActionsContext = createContext<Omit<UploadManagerContextValue, 'items' | 'isPanelVisible'> | null>(null);

const UploadManagerContext = createContext<UploadManagerContextValue | null>(null);

const getQueueKey = (file: File, target: UploadTarget) =>
    `${target.connectionId}-${target.path}-${file.name}-${file.size}-${file.lastModified}-${target.uploadMode ?? 'backend'}`;

const getRemoteQueueKey = (remote: RemoteUploadRequest, target: UploadTarget) =>
    `${target.connectionId}-${target.path}-${remote.url}-${remote.filename ?? ''}-${Date.now()}`;

export function UploadManagerProvider({
    children,
}: Readonly<{ children: ReactNode }>) {
    const [items, setItems] = useState<UploadQueueItem[]>([]);
    const [isPanelVisible, setIsPanelVisible] = useState(false);
    const pausedUploads = useRef(new Set<string>());
    const cancelledUploads = useRef(new Set<string>());
    const activeUploadKeys = useRef(new Set<string>());
    const abortControllers = useRef(new Map<string, AbortController>());
    const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const MAX_CONCURRENT_UPLOADS = 3;
    const fileBrowserLocation = useRef<FileBrowserLocation | null>(null);
    const { props } = usePage<{ auth?: { user?: User | null } }>();
    const user = props.auth?.user;

    const updateItem = useCallback(
        (key: string, changes: Partial<UploadQueueItem>) => {
            setItems((currentItems) =>
                currentItems.map((item) => {
                    if (item.key === key) {
                        const updated = { ...item, ...changes };

                        if (['completed', 'failed', 'cancelled'].includes(updated.status)) {
                            delete updated.file;
                            delete updated.remote;
                        }

                        return updated;
                    }

                    return item;
                })
            );
        },
        [],
    );

    const refreshFilesIfActive = useCallback((task: CloudUploadTask) => {
        const location = fileBrowserLocation.current;

        if (
            location?.connectionId === task.connection_id &&
            location.path === task.target_path
        ) {
            if (refreshTimeoutRef.current) {
                clearTimeout(refreshTimeoutRef.current);
            }

            refreshTimeoutRef.current = setTimeout(() => {
                router.reload({ only: ['files', 'connection'] });
                refreshTimeoutRef.current = null;
            }, 400);
        }
    }, []);

    const uploadDirectFile = useCallback(
        async (
            key: string,
            file: File,
            target: UploadTarget,
            task: CloudUploadTask,
        ) => {
            let latestTask = task;

            const existingMultipart = task.payload.s3_multipart;
            const canResume =
                typeof existingMultipart?.upload_id === 'string' &&
                existingMultipart.upload_id !== '' &&
                Array.isArray(existingMultipart.parts) &&
                existingMultipart.parts.length > 0;

            if (!canResume) {
                const controller = new AbortController();
                abortControllers.current.set(key, controller);
                let initialized;

                try {
                    initialized = await requestJson<{
                        task: CloudUploadTask;
                        multipart: {
                            upload_id: string;
                            key: string;
                            parts: Array<{ ETag: string; PartNumber: number }>;
                        };
                    }>(
                        `/connections/${target.connectionId}/upload-tasks/${task.id}/direct/init`,
                        { method: 'POST', signal: controller.signal },
                    );
                } catch (err: any) {
                    if (err.name === 'AbortError') {
return;
}

                    throw err;
                } finally {
                    abortControllers.current.delete(key);
                }

                latestTask = initialized.task;
            }

            updateItem(key, { task: latestTask, uploadMode: 'direct' });

            if (cancelledUploads.current.has(key)) {
                updateItem(key, { status: 'cancelled' });

                return;
            }

            const chunkSize = latestTask.payload.chunk_size;

            for (
                let index = 0;
                index < latestTask.payload.total_chunks;
                index++
            ) {
                if (cancelledUploads.current.has(key)) {
                    updateItem(key, { status: 'cancelled' });

                    return;
                }

                if (pausedUploads.current.has(key)) {
                    updateItem(key, { status: 'paused' });

                    return;
                }

                const partNumber = index + 1;
                const alreadyUploaded = (
                    latestTask.payload.s3_multipart?.parts ?? []
                ).some((part) => part.PartNumber === partNumber);

                if (alreadyUploaded) {
                    continue;
                }

                const controller = new AbortController();
                abortControllers.current.set(key, controller);

                let part, response;

                try {
                    part = await requestJson<{ url: string }>(
                        `/connections/${target.connectionId}/upload-tasks/${task.id}/direct/part`,
                        {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ part_number: partNumber }),
                            signal: controller.signal
                        },
                    );

                    response = await fetch(part.url, {
                        method: 'PUT',
                        body: file.slice(
                            index * chunkSize,
                            Math.min(file.size, (index + 1) * chunkSize),
                        ),
                        signal: controller.signal
                    });
                } catch (err: any) {
                    if (err.name === 'AbortError') {
return;
}

                    throw err;
                } finally {
                    abortControllers.current.delete(key);
                }

                if (!response.ok) {
                    throw new Error('Direct upload failed.');
                }

                if (cancelledUploads.current.has(key)) {
                    updateItem(key, { status: 'cancelled' });

                    return;
                }

                const etag = response.headers.get('etag');

                if (!etag) {
                    throw new Error('Direct upload did not return an ETag.');
                }

                const doneController = new AbortController();
                abortControllers.current.set(key, doneController);

                try {
                    latestTask = await requestJson<CloudUploadTask>(
                        `/connections/${target.connectionId}/upload-tasks/${task.id}/direct/parts/${partNumber}/done`,
                        {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ etag }),
                            signal: doneController.signal
                        },
                    );
                } catch (err: any) {
                    if (err.name === 'AbortError') {
return;
}

                    throw err;
                } finally {
                    abortControllers.current.delete(key);
                }

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

            if (cancelledUploads.current.has(key)) {
                updateItem(key, { status: 'cancelled' });

                return;
            }

            const completeController = new AbortController();
            abortControllers.current.set(key, completeController);

            try {
                latestTask = await requestJson<CloudUploadTask>(
                    `/connections/${target.connectionId}/upload-tasks/${task.id}/direct/complete`,
                    { method: 'POST', signal: completeController.signal },
                );
            } catch (err: any) {
                if (err.name === 'AbortError') {
return;
}

                throw err;
            } finally {
                abortControllers.current.delete(key);
            }

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
                if (cancelledUploads.current.has(key)) {
                    updateItem(key, { status: 'cancelled' });

                    return;
                }

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

                const controller = new AbortController();
                abortControllers.current.set(key, controller);

                let updatedTask;

                try {
                    updatedTask = await requestJson<CloudUploadTask>(
                        connections.uploadTasks.chunks.store({
                            connection: target.connectionId,
                            task: task.id,
                        }).url,
                        {
                            method: 'POST',
                            body: formData,
                            signal: controller.signal
                        },
                    );
                } catch (err: any) {
                    if (err.name === 'AbortError') {
return;
}

                    throw err;
                } finally {
                    abortControllers.current.delete(key);
                }

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
                const controller = new AbortController();
                abortControllers.current.set(key, controller);

                let task = existingTask;

                if (!task) {
                    try {
                        task = await requestJson<CloudUploadTask>(
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
                                signal: controller.signal
                            },
                        );
                    } catch (err: any) {
                        if (err.name === 'AbortError') {
return;
}

                        throw err;
                    } finally {
                        abortControllers.current.delete(key);
                    }
                }

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

                const controller = new AbortController();
                abortControllers.current.set(key, controller);
                let task;

                try {
                    task = await requestJson<CloudUploadTask>(
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
                            signal: controller.signal
                        },
                    );
                } catch (err: any) {
                    if (err.name === 'AbortError') {
return;
}

                    throw err;
                } finally {
                    abortControllers.current.delete(key);
                }

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

    const pumpQueue = useCallback((currentItems: UploadQueueItem[]) => {
        const activeCount = activeUploadKeys.current.size;
        const availableSlots = Math.max(0, MAX_CONCURRENT_UPLOADS - activeCount);

        if (availableSlots <= 0) {
            return;
        }

        const pendingItems = currentItems.filter((i) => i.status === 'pending' && !activeUploadKeys.current.has(i.key));
        const itemsToStart = pendingItems.slice(0, availableSlots);

        itemsToStart.forEach((item) => {
            activeUploadKeys.current.add(item.key);

            if (item.source === 'remote' && item.remote) {
                uploadRemoteFile(item.key, item.remote, {
                    connectionId: item.connectionId,
                    path: item.path,
                    uploadMode: 'remote',
                }).finally(() => {
                    activeUploadKeys.current.delete(item.key);
                    // trigger a state update to re-evaluate the effect
                    setItems((latest) => [...latest]);
                });
            } else if (item.file) {
                uploadFile(item.key, item.file, {
                    connectionId: item.connectionId,
                    path: item.path,
                    uploadMode: item.uploadMode,
                }, item.task).finally(() => {
                    activeUploadKeys.current.delete(item.key);
                    // trigger a state update to re-evaluate the effect
                    setItems((latest) => [...latest]);
                });
            }
        });
    }, [uploadFile, uploadRemoteFile]);

    useEffect(() => {
        pumpQueue(items);
    }, [items, pumpQueue]);

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

            setItems((currentItems) => {
                const nextItems = [...queueItems, ...currentItems];
                setTimeout(() => pumpQueue(nextItems), 0);

                return nextItems;
            });
            setIsPanelVisible(true);
        },
        [pumpQueue],
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

            setItems((currentItems) => {
                const nextItems = [item, ...currentItems];
                setTimeout(() => pumpQueue(nextItems), 0);

                return nextItems;
            });
            setIsPanelVisible(true);
        },
        [pumpQueue],
    );

    const pause = useCallback(
        async (item: UploadQueueItem) => {
            pausedUploads.current.add(item.key);

            const controller = abortControllers.current.get(item.key);

            if (controller) {
                controller.abort();
                abortControllers.current.delete(item.key);
            }

            updateItem(item.key, { status: 'paused' });

            if (item.task) {
                await requestJson<CloudUploadTask>(
                    connections.uploadTasks.pause({
                        connection: item.connectionId,
                        task: item.task.id,
                    }).url,
                    { method: 'PATCH' },
                ).catch(() => {});
            }
        },
        [updateItem],
    );

    const resume = useCallback(
        async (item: UploadQueueItem) => {
            if (!item.task || item.source === 'remote') {
                return;
            }

            cancelledUploads.current.delete(item.key);
            pausedUploads.current.delete(item.key);
            const task = await requestJson<CloudUploadTask>(
                connections.uploadTasks.resume({
                    connection: item.connectionId,
                    task: item.task.id,
                }).url,
                { method: 'PATCH' },
            );
            updateItem(item.key, { task, status: 'uploading' });

            if (!item.file) {
                return;
            }

            uploadFile(
                item.key,
                item.file,
                {
                    connectionId: item.connectionId,
                    path: item.path,
                    uploadMode: item.uploadMode,
                },
                task,
            ).catch(() => {
                // Errors are recorded on the queue item inside uploadFile.
            });
        },
        [updateItem, uploadFile],
    );

    const cancel = useCallback(
        async (item: UploadQueueItem) => {
            cancelledUploads.current.add(item.key);
            pausedUploads.current.add(item.key);

            const controller = abortControllers.current.get(item.key);

            if (controller) {
                controller.abort();
                abortControllers.current.delete(item.key);
            }

            updateItem(item.key, { status: 'cancelled' });

            if (item.task) {
                if (item.uploadMode === 'direct') {
                    await requestJson<CloudUploadTask>(
                        `/connections/${item.connectionId}/upload-tasks/${item.task.id}/direct/abort`,
                        { method: 'DELETE' },
                    ).catch(() => {});
                } else {
                    await requestJson<CloudUploadTask>(
                        connections.uploadTasks.destroy({
                            connection: item.connectionId,
                            task: item.task.id,
                        }).url,
                        { method: 'DELETE' },
                    ).catch(() => {});
                }
            }
        },
        [updateItem],
    );

    const retry = useCallback(
        (item: UploadQueueItem) => {
            pausedUploads.current.delete(item.key);

            if (item.source === 'remote' && item.remote) {
                uploadRemoteFile(item.key, item.remote, {
                    connectionId: item.connectionId,
                    path: item.path,
                    uploadMode: 'remote',
                }).catch(() => {
                    // Errors are recorded on the queue item inside uploadRemoteFile.
                });

                return;
            }

            if (!item.file) {
                return;
            }

            uploadFile(
                item.key,
                item.file,
                {
                    connectionId: item.connectionId,
                    path: item.path,
                    uploadMode: item.uploadMode,
                },
                undefined,
            ).catch(() => {
                // Errors are recorded on the queue item inside uploadFile.
            });
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
                currentItems.map((item) => {
                    if (item.task?.id === task.id) {
                        const updatedItem = {
                            ...item,
                            task,
                            progress: task.progress,
                            status: task.status,
                            error: task.error_message || undefined,
                        };

                        if (task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled') {
                            delete updatedItem.file;
                            delete updatedItem.remote;
                        }

                        return updatedItem;
                    }

                    return item;
                }),
            );

            if (task.status === 'completed') {
                refreshFilesIfActive(task);
            }
        },
        [refreshFilesIfActive],
    );

    const activeTaskIdsAndConnectionIds = items
        .filter((i) => i.task && (i.status === 'queued' || i.status === 'processing'))
        .map((i) => `${i.task!.id}:${i.connectionId}`)
        .sort()
        .join(',');

    useEffect(() => {
        if (!activeTaskIdsAndConnectionIds) {
return;
}

        const taskRefs = activeTaskIdsAndConnectionIds.split(',').map((ref) => {
            const [taskId, connectionId] = ref.split(':');

            return { taskId: Number(taskId), connectionId: Number(connectionId) };
        });

        const inFlightPolls = new Set<number>();

        const intervalId = globalThis.setInterval(() => {
            taskRefs.forEach(({ taskId, connectionId }) => {
                if (inFlightPolls.has(taskId)) {
return;
}

                inFlightPolls.add(taskId);
                requestJson<CloudUploadTask>(
                    connections.uploadTasks.show({
                        connection: connectionId,
                        task: taskId,
                    }).url,
                )
                    .then((task) => {
                        mergeBroadcastTask(task);
                    })
                    .catch(() => {
                        // Polling is best-effort when Echo is unavailable.
                    })
                    .finally(() => {
                        inFlightPolls.delete(taskId);
                    });
            });
        }, 3000);

        return () => {
            globalThis.clearInterval(intervalId);
        };
    }, [activeTaskIdsAndConnectionIds, mergeBroadcastTask]);

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
            <UploadManagerStateContext.Provider value={{ items, isPanelVisible }}>
                <UploadManagerActionsContext.Provider
                    value={{
                        enqueue: value.enqueue,
                        enqueueRemote: value.enqueueRemote,
                        pause: value.pause,
                        resume: value.resume,
                        cancel: value.cancel,
                        retry: value.retry,
                        remove: value.remove,
                        closePanel: value.closePanel,
                        registerFileBrowserLocation: value.registerFileBrowserLocation,
                    }}
                >
            {user?.id ? (
                <CloudTaskBroadcastListener
                    userId={user.id}
                    onUpdate={mergeBroadcastTask}
                />
            ) : null}
            {children}
                        </UploadManagerActionsContext.Provider>
            </UploadManagerStateContext.Provider>
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

export function useUploadManagerState() {
    const context = useContext(UploadManagerStateContext);

    if (!context) {
throw new Error('useUploadManagerState must be used within an UploadManagerProvider.');
}

    return context;
}

export function useUploadManagerActions() {
    const context = useContext(UploadManagerActionsContext);

    if (!context) {
throw new Error('useUploadManagerActions must be used within an UploadManagerProvider.');
}

    return context;
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
