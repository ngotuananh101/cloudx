import {
    Folder,
    FileText,
    FileImage,
    FileCode,
    FileArchive,
    FileVideo,
    FileAudio,
    File,
    Download,
    Trash2,
    Share2,
    Eye,
    HardDrive,
    ArrowRightLeft,
} from 'lucide-react';
import type { CSSProperties, KeyboardEvent } from 'react';
import { encodeCloudPath } from '@/lib/cloud-path';
import { formatBytes } from '@/lib/format-bytes';
import files from '@/routes/cloud/files';
import type { CloudFile, ProviderCapabilities } from '@/types/cloud';
import { Button } from './ui/button';

interface FileTableRowProps {
    item: CloudFile;
    style: CSSProperties;
    capabilities?: ProviderCapabilities;
    onNavigate?: (item: CloudFile) => void;
    onPreview?: (item: CloudFile) => void;
    onMove?: (item: CloudFile) => void;
    onShare?: (item: CloudFile) => void;
    onDelete?: (item: CloudFile) => void;
    connectionId?: number;
}

export function FileTableRow({
    item,
    style,
    capabilities,
    onNavigate,
    onPreview,
    onMove,
    onShare,
    onDelete,
    connectionId,
}: FileTableRowProps) {
    const getIcon = () => {
        switch (item.type) {
            case 'folder':
                return (
                    <Folder className="h-4.5 w-4.5 fill-blue-500/20 text-blue-500 dark:fill-blue-500/30 dark:text-blue-400" />
                );
            case 'document':
                return <FileText className="h-4.5 w-4.5 text-gray-500 dark:text-gray-400" />;
            case 'image':
                return <FileImage className="h-4.5 w-4.5 text-emerald-500" />;
            case 'code':
                return <FileCode className="h-4.5 w-4.5 text-amber-500" />;
            case 'archive':
                return <FileArchive className="h-4.5 w-4.5 text-red-500" />;
            case 'video':
                return <FileVideo className="h-4.5 w-4.5 text-purple-500" />;
            case 'audio':
                return <FileAudio className="h-4.5 w-4.5 text-pink-500" />;
            default:
                return <File className="h-4.5 w-4.5 text-gray-400 dark:text-gray-500" />;
        }
    };

    const hasActions = Boolean(
        capabilities?.share || capabilities?.download || capabilities?.delete,
    );

    const handleFolderKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        if (!item.isDirectory || (event.key !== 'Enter' && event.key !== ' ')) {
            return;
        }

        event.preventDefault();
        if (item.isDirectory) {
            onNavigate?.(item);
        } else {
            onPreview?.(item);
        }
    };

    const handleDownload = () => {
        if (item.isDirectory || !connectionId) {
            return;
        }

        const url = files.download.url({
            connection: connectionId,
            path: encodeCloudPath(item.path),
        });

        window.location.href = url;
    };

    return (
        <div
            style={style}
            className="group absolute top-0 left-0 flex h-12 w-full items-center border-b border-gray-50 dark:border-gray-800 bg-white dark:bg-gray-900 px-6 transition-colors hover:bg-gray-50/80 dark:hover:bg-gray-800/80"
        >
            {/* Name Column */}
            <div
                className={`flex min-w-0 flex-1 items-center gap-3 pr-4 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-200`}
                onClick={() => item.isDirectory ? onNavigate?.(item) : onPreview?.(item)}
                onKeyDown={handleFolderKeyDown}
                role="button"
                tabIndex={0}
            >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-50 dark:bg-gray-800 group-hover:bg-white dark:group-hover:bg-gray-900">
                    {getIcon()}
                </div>
                <span className="truncate text-sm font-medium text-gray-900 dark:text-gray-100 transition-colors group-hover:text-blue-600 dark:group-hover:text-blue-400">
                    {item.name}
                </span>
            </div>

            {/* Size Column */}
            <div className="w-32 shrink-0 pr-4 text-xs font-medium text-gray-500 dark:text-gray-400">
                {item.isDirectory ? '--' : formatBytes(item.size)}
            </div>

            {/* Type Column */}
            <div className="w-32 shrink-0 pr-4 text-xs font-medium text-gray-500 dark:text-gray-400 capitalize">
                {item.type}
            </div>

            {/* Date Column */}
            <div className="w-32 shrink-0 pr-4 text-xs font-medium text-gray-500 dark:text-gray-400">
                {item.updatedAt}
            </div>

            {/* Actions Column */}
            <div className="flex w-24 shrink-0 justify-end gap-1">
                {hasActions && (
                    <>
                        <div className="flex opacity-0 transition-opacity duration-200 group-focus-within:opacity-100 group-hover:opacity-100">
                            {capabilities?.share && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onShare?.(item);
                                    }}
                                    className="h-8 w-8 rounded-lg text-gray-400 dark:text-gray-500 hover:text-gray-900 dark:hover:text-gray-100"
                                    aria-label={`Share ${item.name}`}
                                >
                                    <Share2 className="h-4 w-4" />
                                </Button>
                            )}
                            {capabilities?.move && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onMove?.(item);
                                    }}
                                    className="h-8 w-8 rounded-lg text-gray-400 dark:text-gray-500 hover:text-gray-900 dark:hover:text-gray-100"
                                    aria-label={`Move ${item.name}`}
                                >
                                    <ArrowRightLeft className="h-4 w-4" />
                                </Button>
                            )}

                            {capabilities?.download && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={handleDownload}
                                    className="h-8 w-8 rounded-lg text-gray-400 dark:text-gray-500 hover:text-gray-900 dark:hover:text-gray-100"
                                    aria-label={`Download ${item.name}`}
                                >
                                    <Download className="h-4 w-4" />
                                </Button>
                            )}
                            {capabilities?.delete && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onDelete?.(item);
                                    }}
                                    className="h-8 w-8 rounded-lg text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400"
                                    aria-label={`Delete ${item.name}`}
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
