import { usePage } from '@inertiajs/react';
import { useEcho } from '@laravel/echo-react';
import {
    AlertCircle,
    AlertTriangle,
    CheckCircle2,
    Cookie,
    Download,
    Loader2,
    Plus,
    RotateCw,
    Save,
    Trash2,
    X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Progress } from '@/components/ui/progress';
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout';
import { xsrfToken } from '@/lib/csrf';
import { formatBytes } from '@/lib/format-bytes';
import type { User } from '@/types';
import type {
    DownloadJob,
    SavedCookie,
    SavedCookieDetail,
    VideoFormat,
    VideoMetadata,
} from '@/types/video-downloader';
import SavedCookieController from '@/actions/App/Http/Controllers/SavedCookieController';

function formatDuration(seconds: number): string {
    if (!Number.isFinite(seconds) || seconds < 0) {
        return '--';
    }

    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);

    return h > 0
        ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
        : `${m}:${String(s).padStart(2, '0')}`;
}

function formatCount(value: number): string {
    if (!Number.isFinite(value)) {
        return '0';
    }

    if (value >= 1_000_000) {
        return `${(value / 1_000_000).toFixed(1)}M`;
    }

    if (value >= 1_000) {
        return `${(value / 1_000).toFixed(1)}K`;
    }

    return String(value);
}

export default function VideoDownloaderIndex({
    savedCookies: initialSavedCookies,
}: {
    savedCookies: SavedCookie[];
}) {
    const [url, setUrl] = useState('');
    const [cookies, setCookies] = useState('');
    const [showTextarea, setShowTextarea] = useState(false);
    const [selectedCookieId, setSelectedCookieId] = useState<string>('');
    const [selectedCookieLabel, setSelectedCookieLabel] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const [metadata, setMetadata] = useState<VideoMetadata | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [selectedFormatId, setSelectedFormatId] = useState<string | null>(
        null,
    );
    const [savedCookies, setSavedCookies] =
        useState<SavedCookie[]>(initialSavedCookies);
    const [saveLabel, setSaveLabel] = useState('');
    const [showSaveModal, setShowSaveModal] = useState(false);
    const [savingCookie, setSavingCookie] = useState(false);
    const [loadingCookie, setLoadingCookie] = useState(false);

    // Async download job states
    const [job, setJob] = useState<DownloadJob | null>(null);
    const [startingJob, setStartingJob] = useState(false);
    const [jobError, setJobError] = useState<string | null>(null);
    const downloadTriggeredRef = useRef(false);

    const jsonHeaders = {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'X-XSRF-TOKEN': xsrfToken(),
        Accept: 'application/json',
    };

    const refreshSavedCookies = async () => {
        try {
            const response = await fetch(SavedCookieController.index.url(), {
                headers: jsonHeaders,
            });

            if (response.ok) {
                setSavedCookies((await response.json()) as SavedCookie[]);
            }
        } catch {
            // silently ignore
        }
    };

    const handleSelectCookie = async (idStr: string) => {
        if (!idStr) {
            setSelectedCookieId('');
            setSelectedCookieLabel('');
            setCookies('');

            return;
        }

        const id = Number(idStr);
        const matched = savedCookies.find((c) => c.id === id);
        setSelectedCookieId(idStr);
        setSelectedCookieLabel(matched?.label ?? '');
        setLoadingCookie(true);

        try {
            const response = await fetch(SavedCookieController.show.url(id), {
                headers: jsonHeaders,
            });

            if (response.ok) {
                const data = (await response.json()) as SavedCookieDetail;
                setCookies(data.cookies);
            }
        } catch {
            // silently ignore
        } finally {
            setLoadingCookie(false);
        }
    };

    const handleSaveCookie = async () => {
        if (!saveLabel.trim() || !cookies.trim()) {
            return;
        }

        setSavingCookie(true);

        try {
            const response = await fetch(SavedCookieController.store.url(), {
                method: 'POST',
                headers: jsonHeaders,
                body: JSON.stringify({
                    label: saveLabel.trim(),
                    cookies,
                }),
            });

            if (response.ok) {
                const created = (await response.json()) as SavedCookie;
                setSaveLabel('');
                setShowSaveModal(false);
                await refreshSavedCookies();
                setSelectedCookieId(String(created.id));
                setSelectedCookieLabel(created.label);
            }
        } catch {
            // silently ignore
        } finally {
            setSavingCookie(false);
        }
    };

    const handleDeleteSelectedCookie = async () => {
        if (!selectedCookieId) {
            return;
        }

        const id = Number(selectedCookieId);

        try {
            await fetch(SavedCookieController.destroy.url(id), {
                method: 'DELETE',
                headers: jsonHeaders,
            });
            setSavedCookies((prev) => prev.filter((c) => c.id !== id));
            setSelectedCookieId('');
            setSelectedCookieLabel('');
            setCookies('');
        } catch {
            // silently ignore
        }
    };

    const clearCookies = () => {
        setCookies('');
        setSelectedCookieId('');
        setSelectedCookieLabel('');
    };

    const fetchInfo = async (event: FormEvent) => {
        event.preventDefault();
        setLoading(true);
        setError(null);
        setMetadata(null);
        setSelectedFormatId(null);
        setJob(null);
        setJobError(null);
        downloadTriggeredRef.current = false;

        try {
            const response = await fetch('/video-downloader/metadata', {
                method: 'POST',
                headers: jsonHeaders,
                body: JSON.stringify({
                    url,
                    cookies: cookies || null,
                }),
            });

            const data = (await response.json().catch(() => ({}))) as Record<
                string,
                unknown
            >;

            if (!response.ok) {
                throw new Error(
                    (data.message as string) ?? 'Failed to fetch video info.',
                );
            }

            setMetadata(data as unknown as VideoMetadata);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred.');
        } finally {
            setLoading(false);
        }
    };

    const selectedFormat: VideoFormat | null =
        metadata?.formats.find(
            (format) => format.format_id === selectedFormatId,
        ) ?? null;

    // Start async download job
    const startDownloadJob = async () => {
        if (!metadata || !selectedFormatId) {
            return;
        }

        setStartingJob(true);
        setJobError(null);
        downloadTriggeredRef.current = false;

        try {
            const response = await fetch('/video-downloader/jobs', {
                method: 'POST',
                headers: jsonHeaders,
                body: JSON.stringify({
                    url,
                    format_id: selectedFormatId,
                    audio_only: selectedFormat?.audio_only ?? false,
                    cookies: cookies || null,
                }),
            });

            const data = (await response.json().catch(() => ({}))) as Record<
                string,
                unknown
            >;

            if (!response.ok) {
                throw new Error(
                    (data.message as string) ?? 'Failed to start download job.',
                );
            }

            setJob({
                job_id: data.job_id as string,
                status: (data.status as DownloadJob['status']) || 'pending',
                progress: 0,
                speed_str: '',
                eta_str: '',
                filename: '',
                error: '',
            });
        } catch (err) {
            setJobError(
                err instanceof Error
                    ? err.message
                    : 'Could not start download.',
            );
        } finally {
            setStartingJob(false);
        }
    };

    const { props } = usePage<{ auth?: { user?: User | null } }>();
    const user = props.auth?.user;

    // Handle incoming real-time socket updates for video downloads
    const handleJobUpdate = (updated: DownloadJob) => {
        if (!job || job.job_id !== updated.job_id) {
            return;
        }

        setJob(updated);

        if (updated.status === 'failed' && updated.error) {
            setJobError(updated.error);
        }

        if (updated.status === 'completed' && !downloadTriggeredRef.current) {
            downloadTriggeredRef.current = true;
            globalThis.location.href = `/video-downloader/jobs/${updated.job_id}/download`;
        }
    };

    // Active polling (1.5s interval) as dual safety-net with WebSocket
    const activeJobId =
        job && job.status !== 'completed' && job.status !== 'failed'
            ? job.job_id
            : null;

    useEffect(() => {
        if (!activeJobId) {
            return;
        }

        let isCancelled = false;
        let inFlight = false;

        const pollTick = async () => {
            if (inFlight) {
                return;
            }

            inFlight = true;

            try {
                const response = await fetch(
                    `/video-downloader/jobs/${activeJobId}`,
                    {
                        headers: {
                            'Content-Type': 'application/json',
                            'X-Requested-With': 'XMLHttpRequest',
                            'X-XSRF-TOKEN': xsrfToken(),
                            Accept: 'application/json',
                        },
                    },
                );

                if (response.status === 404) {
                    if (!isCancelled) {
                        setJobError('Download job not found or expired.');
                        setJob((prev) =>
                            prev
                                ? {
                                      ...prev,
                                      status: 'failed',
                                      error: 'Job expired',
                                  }
                                : null,
                        );
                    }

                    return;
                }

                if (!response.ok) {
                    return;
                }

                const updated = (await response.json()) as DownloadJob;

                if (!isCancelled) {
                    handleJobUpdate(updated);
                }
            } catch {
                // Silently ignore transient network blips while polling
            } finally {
                inFlight = false;
            }
        };

        const intervalId = globalThis.setInterval(pollTick, 1500);
        pollTick(); // Immediate first check

        return () => {
            isCancelled = true;
            globalThis.clearInterval(intervalId);
        };
    }, [activeJobId]);

    return (
        <AuthenticatedLayout title="Video Downloader">
            <div className="mx-auto max-w-4xl space-y-6">
                <div>
                    <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
                        Video Downloader
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Paste a video URL to fetch available formats and
                        download the file.
                    </p>
                </div>

                <form
                    onSubmit={fetchInfo}
                    className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm"
                >
                    {/* URL Input */}
                    <div>
                        <label
                            htmlFor="vd-url"
                            className="text-xs font-bold text-foreground"
                        >
                            Video URL
                        </label>
                        <input
                            id="vd-url"
                            type="url"
                            required
                            value={url}
                            onChange={(event) => setUrl(event.target.value)}
                            placeholder="https://www.youtube.com/watch?v=..."
                            className="mt-1 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm font-medium text-foreground transition outline-none focus:border-ring focus:ring-2 focus:ring-ring/50"
                        />
                    </div>

                    {/* Cookies Bar — Always Visible */}
                    <div className="space-y-2 rounded-xl border border-border/70 bg-muted/30 p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                                <Cookie className="h-4 w-4 text-muted-foreground" />
                                <span className="text-xs font-bold text-foreground">
                                    Cookies
                                </span>
                                {selectedCookieLabel && (
                                    <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                                        Using: {selectedCookieLabel}
                                        <button
                                            type="button"
                                            onClick={clearCookies}
                                            className="hover:text-destructive"
                                        >
                                            <X className="h-3 w-3" />
                                        </button>
                                    </span>
                                )}
                                {loadingCookie && (
                                    <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                                )}
                            </div>

                            <div className="flex items-center gap-2">
                                {cookies.trim() && !selectedCookieId && (
                                    <button
                                        type="button"
                                        onClick={() => setShowSaveModal(true)}
                                        className="inline-flex h-7 items-center gap-1 rounded-lg bg-primary/10 px-2.5 text-xs font-semibold text-primary transition hover:bg-primary/20"
                                    >
                                        <Save className="h-3 w-3" />
                                        Save current
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={() =>
                                        setShowTextarea((curr) => !curr)
                                    }
                                    className="text-xs font-semibold text-muted-foreground hover:text-foreground"
                                >
                                    {showTextarea
                                        ? 'Hide raw cookies'
                                        : 'Paste / edit raw'}
                                </button>
                            </div>
                        </div>

                        {/* Dropdown to pick saved cookies */}
                        {savedCookies.length > 0 && (
                            <div className="flex items-center gap-2">
                                <select
                                    value={selectedCookieId}
                                    onChange={(e) =>
                                        handleSelectCookie(e.target.value)
                                    }
                                    className="h-9 flex-1 rounded-lg border border-border bg-background px-2.5 text-xs font-medium text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/50"
                                >
                                    <option value="">
                                        -- Select saved cookies --
                                    </option>
                                    {savedCookies.map((saved) => (
                                        <option
                                            key={saved.id}
                                            value={String(saved.id)}
                                        >
                                            {saved.label}
                                        </option>
                                    ))}
                                </select>

                                {selectedCookieId && (
                                    <button
                                        type="button"
                                        onClick={handleDeleteSelectedCookie}
                                        title="Delete this saved cookie"
                                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                )}
                            </div>
                        )}

                        {/* Save inline input */}
                        {showSaveModal && (
                            <div className="flex items-center gap-2 pt-1">
                                <input
                                    type="text"
                                    value={saveLabel}
                                    onChange={(e) =>
                                        setSaveLabel(e.target.value)
                                    }
                                    placeholder="Label, e.g. YouTube main acc"
                                    className="h-8 flex-1 rounded-lg border border-border bg-background px-2 text-xs text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/50"
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            handleSaveCookie();
                                        }
                                    }}
                                />
                                <button
                                    type="button"
                                    onClick={handleSaveCookie}
                                    disabled={savingCookie || !saveLabel.trim()}
                                    className="inline-flex h-8 items-center gap-1 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
                                >
                                    {savingCookie ? (
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                        <Plus className="h-3 w-3" />
                                    )}
                                    Save
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowSaveModal(false)}
                                    className="inline-flex h-8 items-center rounded-lg border border-border px-2 text-xs text-muted-foreground hover:text-foreground"
                                >
                                    Cancel
                                </button>
                            </div>
                        )}

                        {/* Raw textarea */}
                        {showTextarea && (
                            <div className="pt-2">
                                <label
                                    htmlFor="vd-cookies"
                                    className="text-xs font-medium text-muted-foreground"
                                >
                                    Netscape format or key=value; pairs
                                </label>
                                <textarea
                                    id="vd-cookies"
                                    value={cookies}
                                    onChange={(e) => {
                                        setCookies(e.target.value);
                                        setSelectedCookieId('');
                                        setSelectedCookieLabel('');
                                    }}
                                    rows={4}
                                    placeholder="# Netscape HTTP Cookie File&#10;.youtube.com	TRUE	/	FALSE	0	SID	abc..."
                                    className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 font-mono text-xs text-foreground transition outline-none focus:border-ring focus:ring-2 focus:ring-ring/50"
                                />
                            </div>
                        )}
                    </div>

                    {error && (
                        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading || !url}
                        className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:opacity-60"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Fetching...
                            </>
                        ) : (
                            'Get info'
                        )}
                    </button>
                </form>

                {/* Metadata Card */}
                {metadata && (
                    <div className="space-y-5 rounded-2xl border border-border bg-card p-6 shadow-sm">
                        {metadata.cookies_warning && (
                            <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-600 dark:text-amber-400">
                                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                                <span>{metadata.cookies_warning}</span>
                            </div>
                        )}

                        <div className="flex flex-col gap-4 sm:flex-row">
                            {metadata.thumbnail && (
                                <img
                                    src={metadata.thumbnail}
                                    alt={metadata.title}
                                    className="h-40 w-full max-w-[320px] rounded-xl object-cover"
                                />
                            )}
                            <div className="min-w-0 flex-1 space-y-1">
                                <h2 className="truncate text-lg font-bold text-foreground">
                                    {metadata.title}
                                </h2>
                                <p className="text-sm text-muted-foreground">
                                    {metadata.uploader}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    {formatDuration(metadata.duration)} -{' '}
                                    {formatCount(metadata.view_count)} views
                                </p>
                                {metadata.description && (
                                    <p className="line-clamp-3 text-xs text-muted-foreground">
                                        {metadata.description}
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Format Selection List */}
                        <div>
                            <h3 className="mb-2 text-xs font-bold tracking-wider text-muted-foreground">
                                SELECT QUALITY / FORMAT
                            </h3>
                            <ul className="divide-y divide-border rounded-xl border border-border">
                                {metadata.formats.map((format) => {
                                    const isSelected =
                                        format.format_id === selectedFormatId;

                                    return (
                                        <li key={format.format_id}>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setSelectedFormatId(
                                                        format.format_id,
                                                    )
                                                }
                                                className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm transition ${
                                                    isSelected
                                                        ? 'bg-primary/10 font-semibold text-foreground'
                                                        : 'hover:bg-muted'
                                                }`}
                                            >
                                                <span className="flex flex-col">
                                                    <span className="font-semibold text-foreground">
                                                        {format.format_note ??
                                                            format.resolution ??
                                                            format.format_id}
                                                    </span>
                                                    <span className="text-xs text-muted-foreground">
                                                        {format.ext} -{' '}
                                                        {format.resolution}
                                                    </span>
                                                </span>
                                                <span className="text-xs text-muted-foreground">
                                                    {format.filesize
                                                        ? formatBytes(
                                                              format.filesize,
                                                          )
                                                        : 'unknown size'}
                                                </span>
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>

                        {/* Progress Taskbar Banner when Download Job is Active */}
                        {job && (
                            <div className="space-y-3 rounded-xl border border-primary/30 bg-primary/5 p-4 shadow-sm">
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                        {job.status === 'downloading' && (
                                            <Loader2 className="h-4 w-4 animate-spin text-primary" />
                                        )}
                                        {job.status === 'converting' && (
                                            <RotateCw className="h-4 w-4 animate-spin text-primary" />
                                        )}
                                        {job.status === 'pending' && (
                                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                        )}
                                        {job.status === 'completed' && (
                                            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                                        )}
                                        {job.status === 'failed' && (
                                            <AlertCircle className="h-4 w-4 text-destructive" />
                                        )}
                                        <span className="text-xs font-bold text-foreground">
                                            {job.status === 'pending' &&
                                                'Preparing download...'}
                                            {job.status === 'downloading' &&
                                                'Downloading from YouTube...'}
                                            {job.status === 'converting' &&
                                                'Converting & merging streams...'}
                                            {job.status === 'completed' &&
                                                'Download ready! Starting file transfer...'}
                                            {job.status === 'failed' &&
                                                'Download failed.'}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                                        {job.speed_str && (
                                            <span>{job.speed_str}</span>
                                        )}
                                        {job.eta_str && (
                                            <span>ETA: {job.eta_str}</span>
                                        )}
                                        <span className="font-bold text-foreground">
                                            {job.status === 'completed' ||
                                            job.status === 'converting'
                                                ? '100%'
                                                : `${job.progress.toFixed(1)}%`}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => setJob(null)}
                                            className="ml-1 text-muted-foreground hover:text-foreground"
                                        >
                                            <X className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                </div>

                                <Progress
                                    value={
                                        job.status === 'completed' ||
                                        job.status === 'converting'
                                            ? 100
                                            : job.progress
                                    }
                                    className="h-2"
                                />

                                {job.filename && (
                                    <p className="truncate text-xs text-muted-foreground">
                                        File:{' '}
                                        <span className="font-medium text-foreground">
                                            {job.filename}
                                        </span>
                                    </p>
                                )}
                            </div>
                        )}

                        {jobError && (
                            <div className="flex items-center justify-between gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3.5 text-xs text-destructive">
                                <div className="flex items-center gap-2">
                                    <AlertCircle className="h-4 w-4 shrink-0" />
                                    <span>{jobError}</span>
                                </div>
                                <button
                                    type="button"
                                    onClick={startDownloadJob}
                                    className="shrink-0 font-semibold underline hover:no-underline"
                                >
                                    Retry
                                </button>
                            </div>
                        )}

                        {/* Download Trigger Button */}
                        <button
                            type="button"
                            onClick={startDownloadJob}
                            disabled={
                                !selectedFormat ||
                                startingJob ||
                                (job !== null &&
                                    job.status !== 'failed' &&
                                    job.status !== 'completed')
                            }
                            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:opacity-60"
                        >
                            {startingJob ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Starting...
                                </>
                            ) : (
                                <>
                                    <Download className="h-4 w-4" />
                                    Download{' '}
                                    {selectedFormat
                                        ? `${selectedFormat.format_note ?? selectedFormat.format_id}.${selectedFormat.ext}`
                                        : ''}
                                </>
                            )}
                        </button>
                    </div>
                )}
            </div>

            {user?.id ? (
                <VideoDownloadJobBroadcastListener
                    userId={user.id}
                    onUpdate={handleJobUpdate}
                />
            ) : null}
        </AuthenticatedLayout>
    );
}

function VideoDownloadJobBroadcastListener({
    userId,
    onUpdate,
}: {
    userId: number;
    onUpdate: (job: DownloadJob) => void;
}) {
    useEcho<DownloadJob>(
        `users.${userId}.video-jobs`,
        '.VideoDownloadJobUpdated',
        onUpdate,
    );

    return null;
}
