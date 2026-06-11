import DocViewer, { DocViewerRenderers } from '@iamjariwala/react-doc-viewer';
import '@iamjariwala/react-doc-viewer/dist/index.css';
import { usePage } from '@inertiajs/react';
import { Download, Maximize2, Minimize2, X, File, Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useTheme } from '@/components/ThemeProvider';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { encodeCloudPath } from '@/lib/cloud-path';
import { formatBytes } from '@/lib/format-bytes';
import files from '@/routes/cloud/files';
import type { CloudFile } from '@/types/cloud';

export default function FilePreviewModal({
    item,
    connectionId,
    onClose,
}: {
    item: CloudFile | null;
    connectionId: number;
    onClose: () => void;
}) {
    const [isFullscreen, setIsFullscreen] = useState(false);
    const { max_preview_size } = usePage<any>().props;
    const { theme } = useTheme();

    const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

    // Default 50MB if not provided
    const maxSize = max_preview_size ?? 52428800;

    useEffect(() => {
        if (!item) {
            setIsFullscreen(false);
        }
    }, [item]);

    if (!item) {
return null;
}

    const isTooLarge = item.size > maxSize;

    // Use wayfinder's generated route
    const previewUrl = files.preview.url({
        connection: connectionId,
        path: encodeCloudPath(item.path),
    });

    const downloadUrl = files.download.url({
        connection: connectionId,
        path: encodeCloudPath(item.path),
    });

    const handleDownload = () => {
        window.location.href = downloadUrl;
    };

    const NoRendererFallback = () => (
        <div className="flex h-full w-full flex-col items-center justify-center p-6 text-center bg-gray-50 dark:bg-gray-950">
            <div className="mb-4 rounded-full bg-gray-100 dark:bg-gray-800 p-4">
                <File className="h-8 w-8 text-gray-400 dark:text-gray-500" />
            </div>
            <h4 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                Preview not supported
            </h4>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                This file type cannot be previewed in the browser.
            </p>
            <Button className="mt-6" onClick={handleDownload}>
                Download File
            </Button>
        </div>
    );

    const LoadingRenderer = () => (
        <div className="flex h-full w-full flex-col items-center justify-center p-6 text-center bg-gray-50 dark:bg-gray-950">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500 mb-4" />
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Loading preview...
            </p>
        </div>
    );


    return (
        <Dialog open={item !== null} onOpenChange={(open) => !open && onClose()}>
            <DialogContent
                className={`flex flex-col overflow-hidden bg-white dark:bg-gray-900 shadow-2xl transition-all p-0 [&>button]:hidden ${isFullscreen
                    ? 'h-screen w-screen max-w-none sm:max-w-none rounded-none'
                    : 'max-h-[85vh] min-h-100 w-full sm:max-w-4xl rounded-xl border border-gray-100 dark:border-gray-800'
                    }`}
            >
                <DialogHeader className="hidden">
                    <DialogTitle>{item.name}</DialogTitle>
                    <DialogDescription>Previewing {item.name}</DialogDescription>
                </DialogHeader>
                <div className="flex shrink-0 items-center justify-between border-b border-gray-100 dark:border-gray-800 px-4 py-3">
                    <div className="min-w-0 flex-1 pr-4">
                        <h3 className="truncate text-base font-semibold text-gray-900 dark:text-gray-100">
                            {item.name}
                        </h3>
                        <div className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                            {formatBytes(item.size)} • {item.extension?.toUpperCase() || 'FILE'}
                        </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={handleDownload}
                            className="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
                            title="Download"
                        >
                            <Download className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setIsFullscreen(!isFullscreen)}
                            className="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
                            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                        >
                            {isFullscreen ? (
                                <Minimize2 className="h-4 w-4" />
                            ) : (
                                <Maximize2 className="h-4 w-4" />
                            )}
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={onClose}
                            className="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
                            title="Close"
                        >
                            <X className="h-5 w-5" />
                        </Button>
                    </div>
                </div>

                <div className="flex-1 min-h-0 overflow-hidden bg-gray-50 dark:bg-gray-950 relative">
                    {isTooLarge ? (
                        <div className="flex h-full flex-col items-center justify-center p-6 text-center">
                            <div className="mb-4 rounded-full bg-gray-100 dark:bg-gray-800 p-4">
                                <Download className="h-8 w-8 text-gray-400 dark:text-gray-500" />
                            </div>
                            <h4 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                                File is too large to preview
                            </h4>
                            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                                The file size ({formatBytes(item.size)}) exceeds the preview limit of {formatBytes(maxSize)}.
                            </p>
                            <Button className="mt-6" onClick={handleDownload}>
                                Download File
                            </Button>
                        </div>
                    ) : (
                        <DocViewer
                            documents={[
                                { uri: previewUrl, fileName: item.name },
                            ]}
                            pluginRenderers={DocViewerRenderers}
                            className='my-preview'
                            config={{
                                themeMode: isDark ? 'dark' : 'light',
                                header: {
                                    disableHeader: true,
                                },
                                noRenderer: {
                                    overrideComponent: NoRendererFallback,
                                },
                                loadingRenderer: {
                                    overrideComponent: LoadingRenderer,
                                    showLoadingTimeout: 500,
                                },
                            }}
                        />
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
