import DocViewer, { DocViewerRenderers } from '@iamjariwala/react-doc-viewer';
import '@iamjariwala/react-doc-viewer/dist/index.css';
import { Download, File, Loader2, Maximize2, Minimize2, X } from 'lucide-react';
import { useState } from 'react';
import { useTheme } from '@/components/ThemeProvider';
import { Button } from '@/components/ui/button';
import { formatBytes } from '@/lib/format-bytes';

interface SharePreviewProps {
    previewUrl: string;
    fileName: string;
    fileSize: number;
    downloadUrl: string;
}

function NoRendererFallback({
    onDownload,
}: Readonly<{ onDownload: () => void }>) {
    return (
        <div className="flex h-full w-full flex-col items-center justify-center bg-muted p-6 text-center">
            <div className="mb-4 rounded-full bg-muted p-4">
                <File className="h-8 w-8 text-muted-foreground" />
            </div>
            <h4 className="text-lg font-medium text-foreground">
                Preview not supported
            </h4>
            <p className="mt-2 text-sm text-muted-foreground">
                This file type cannot be previewed in the browser.
            </p>
            <Button className="mt-6" onClick={onDownload}>
                Download File
            </Button>
        </div>
    );
}

function LoadingRenderer() {
    return (
        <div className="flex h-full w-full flex-col items-center justify-center bg-muted p-6 text-center">
            <Loader2 className="mb-4 h-8 w-8 animate-spin text-primary" />
            <p className="text-sm font-medium text-foreground">
                Loading preview...
            </p>
        </div>
    );
}

const sharePreviewDownloadRef: { current: (() => void) | null } = {
    current: null,
};

function NoRendererOverride() {
    return (
        <NoRendererFallback
            onDownload={() => sharePreviewDownloadRef.current?.()}
        />
    );
}

function PreviewChrome({
    fileName,
    fileSize,
    isFullscreen,
    isDark,
    previewUrl,
    onDownload,
    onToggleFullscreen,
    onExitFullscreen,
}: Readonly<{
    fileName: string;
    fileSize: number;
    isFullscreen: boolean;
    isDark: boolean;
    previewUrl: string;
    onDownload: () => void;
    onToggleFullscreen: () => void;
    onExitFullscreen: () => void;
}>) {
    return (
        <div
            className={`flex flex-col ${isFullscreen ? 'h-screen w-screen' : 'h-[500px]'}`}
        >
            <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-2.5">
                <div className="min-w-0 flex-1 pr-4">
                    <h3 className="truncate text-sm font-semibold text-foreground">
                        {fileName}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                        {formatBytes(fileSize)}
                    </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground dark:text-muted-foreground"
                        onClick={onDownload}
                        title="Download"
                    >
                        <Download className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground dark:text-muted-foreground"
                        onClick={onToggleFullscreen}
                        title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                    >
                        {isFullscreen ? (
                            <Minimize2 className="h-4 w-4" />
                        ) : (
                            <Maximize2 className="h-4 w-4" />
                        )}
                    </Button>
                    {isFullscreen && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground dark:text-muted-foreground"
                            onClick={onExitFullscreen}
                            title="Close"
                        >
                            <X className="h-5 w-5" />
                        </Button>
                    )}
                </div>
            </div>

            <div className="min-h-0 flex-1 overflow-hidden bg-muted">
                <DocViewer
                    documents={[{ uri: previewUrl, fileName }]}
                    pluginRenderers={DocViewerRenderers}
                    className="my-preview"
                    config={{
                        themeMode: isDark ? 'dark' : 'light',
                        header: { disableHeader: true },
                        noRenderer: {
                            overrideComponent: NoRendererOverride,
                        },
                        loadingRenderer: {
                            overrideComponent: LoadingRenderer,
                            showLoadingTimeout: 500,
                        },
                    }}
                />
            </div>
        </div>
    );
}

export function SharePreview({
    previewUrl,
    fileName,
    fileSize,
    downloadUrl,
}: Readonly<SharePreviewProps>) {
    const [isFullscreen, setIsFullscreen] = useState(false);
    const { theme } = useTheme();
    const isDark =
        theme === 'dark' ||
        (theme === 'system' &&
            globalThis.matchMedia('(prefers-color-scheme: dark)').matches);

    const handleDownload = () => {
        globalThis.location.href = downloadUrl;
    };

    sharePreviewDownloadRef.current = handleDownload;

    const previewContent = (
        <PreviewChrome
            fileName={fileName}
            fileSize={fileSize}
            isFullscreen={isFullscreen}
            isDark={isDark}
            previewUrl={previewUrl}
            onDownload={handleDownload}
            onToggleFullscreen={() => setIsFullscreen((current) => !current)}
            onExitFullscreen={() => setIsFullscreen(false)}
        />
    );

    if (isFullscreen) {
        return (
            <>
                <div className="overflow-hidden rounded-xl border border-border">
                    {previewContent}
                </div>
                <dialog
                    open
                    className="fixed inset-0 z-50 m-0 h-full max-h-none w-full max-w-none border-0 bg-card p-0"
                    onCancel={(event) => {
                        event.preventDefault();
                        setIsFullscreen(false);
                    }}
                    onKeyDown={(event) => {
                        if (event.key === 'Escape') {
                            setIsFullscreen(false);
                        }
                    }}
                >
                    {previewContent}
                </dialog>
            </>
        );
    }

    return (
        <div className="overflow-hidden rounded-xl border border-border">
            {previewContent}
        </div>
    );
}
