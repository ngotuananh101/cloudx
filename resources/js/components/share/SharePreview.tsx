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

export function SharePreview({ previewUrl, fileName, fileSize, downloadUrl }: SharePreviewProps) {
    const [isFullscreen, setIsFullscreen] = useState(false);
    const { theme } = useTheme();
    const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

    const handleDownload = () => {
        window.location.href = downloadUrl;
    };

    const NoRendererFallback = () => (
        <div className="flex h-full w-full flex-col items-center justify-center bg-gray-50 p-6 text-center dark:bg-gray-950">
            <div className="mb-4 rounded-full bg-gray-100 p-4 dark:bg-gray-800">
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
        <div className="flex h-full w-full flex-col items-center justify-center bg-gray-50 p-6 text-center dark:bg-gray-950">
            <Loader2 className="mb-4 h-8 w-8 animate-spin text-blue-500" />
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Loading preview...
            </p>
        </div>
    );

    const previewContent = (
        <div className={`flex flex-col ${isFullscreen ? 'h-screen w-screen' : 'h-[500px]'}`}>
            {/* Header bar */}
            <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-4 py-2.5 dark:border-gray-800">
                <div className="min-w-0 flex-1 pr-4">
                    <h3 className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {fileName}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                        {formatBytes(fileSize)}
                    </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
                        onClick={handleDownload}
                        title="Download"
                    >
                        <Download className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
                        onClick={() => setIsFullscreen(!isFullscreen)}
                        title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                    >
                        {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                    </Button>
                    {isFullscreen && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
                            onClick={() => setIsFullscreen(false)}
                            title="Close"
                        >
                            <X className="h-5 w-5" />
                        </Button>
                    )}
                </div>
            </div>

            {/* DocViewer area */}
            <div className="flex-1 min-h-0 overflow-hidden bg-gray-50 dark:bg-gray-950">
                <DocViewer
                    documents={[{ uri: previewUrl, fileName }]}
                    pluginRenderers={DocViewerRenderers}
                    className="my-preview"
                    config={{
                        themeMode: isDark ? 'dark' : 'light',
                        header: { disableHeader: true },
                        noRenderer: { overrideComponent: NoRendererFallback },
                        loadingRenderer: {
                            overrideComponent: LoadingRenderer,
                            showLoadingTimeout: 500,
                        },
                    }}
                />
            </div>
        </div>
    );

    if (isFullscreen) {
        return (
            <>
                {/* Keep the inline preview visible behind the overlay */}
                <div className="overflow-hidden rounded-xl border border-gray-100 dark:border-gray-800">
                    {previewContent}
                </div>
                {/* Fullscreen overlay */}
                <div
                    className="fixed inset-0 z-50 bg-white dark:bg-gray-950"
                    onKeyDown={(e) => {
                        if (e.key === 'Escape') {
                            setIsFullscreen(false);
                        }
                    }}
                >
                    {previewContent}
                </div>
            </>
        );
    }

    return (
        <div className="overflow-hidden rounded-xl border border-gray-100 dark:border-gray-800">
            {previewContent}
        </div>
    );
}
