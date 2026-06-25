import { Download, Loader2 } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout';
import { formatBytes } from '@/lib/format-bytes';
import type { VideoFormat, VideoMetadata } from '@/types/video-downloader';

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

export default function VideoDownloaderIndex() {
    const [url, setUrl] = useState('');
    const [cookies, setCookies] = useState('');
    const [showCookies, setShowCookies] = useState(false);
    const [loading, setLoading] = useState(false);
    const [metadata, setMetadata] = useState<VideoMetadata | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [selectedFormatId, setSelectedFormatId] = useState<string | null>(
        null,
    );

    const csrfToken = (): string =>
        (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)
            ?.content ?? '';

    const fetchInfo = async (event: FormEvent) => {
        event.preventDefault();
        setLoading(true);
        setError(null);
        setMetadata(null);
        setSelectedFormatId(null);

        try {
            const response = await fetch('/video-downloader/metadata', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': csrfToken(),
                    Accept: 'application/json',
                },
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

    const triggerDownload = () => {
        if (!metadata || !selectedFormatId) {
            return;
        }

        const params = new URLSearchParams({
            url,
            format_id: selectedFormatId,
            cookies: cookies || '',
        });

        window.location.href = `/video-downloader/download?${params.toString()}`;
    };

    const selectedFormat: VideoFormat | null =
        metadata?.formats.find(
            (format) => format.format_id === selectedFormatId,
        ) ?? null;

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
                    className="space-y-3 rounded-2xl border border-border bg-card p-6 shadow-sm"
                >
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

                    <button
                        type="button"
                        onClick={() => setShowCookies((current) => !current)}
                        className="text-xs font-semibold text-muted-foreground hover:text-foreground"
                    >
                        {showCookies
                            ? 'Hide cookies'
                            : 'Use cookies (advanced)'}
                    </button>

                    {showCookies && (
                        <div>
                            <label
                                htmlFor="vd-cookies"
                                className="text-xs font-bold text-foreground"
                            >
                                Cookies (Netscape format)
                            </label>
                            <textarea
                                id="vd-cookies"
                                value={cookies}
                                onChange={(event) =>
                                    setCookies(event.target.value)
                                }
                                rows={4}
                                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 font-mono text-xs text-foreground transition outline-none focus:border-ring focus:ring-2 focus:ring-ring/50"
                            />
                        </div>
                    )}

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

                {metadata && (
                    <div className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm">
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

                        <div>
                            <h3 className="mb-2 text-xs font-bold tracking-wider text-muted-foreground">
                                FORMATS
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

                        <button
                            type="button"
                            onClick={triggerDownload}
                            disabled={!selectedFormat}
                            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:opacity-60"
                        >
                            <Download className="h-4 w-4" />
                            Download{' '}
                            {selectedFormat
                                ? `${selectedFormat.format_note ?? selectedFormat.format_id}.${selectedFormat.ext}`
                                : ''}
                        </button>
                    </div>
                )}
            </div>
        </AuthenticatedLayout>
    );
}
