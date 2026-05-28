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
} from 'lucide-react';
import type { CSSProperties, KeyboardEvent } from 'react';
import { formatBytes } from '@/lib/format-bytes';
import type { CloudFile, ProviderCapabilities } from '@/types/cloud';
import { Button } from './ui/button';

interface FileTableRowProps {
    item: CloudFile;
    style: CSSProperties;
    capabilities?: ProviderCapabilities;
    onNavigate?: (item: CloudFile) => void;
}

export function FileTableRow({
    item,
    style,
    capabilities,
    onNavigate,
}: FileTableRowProps) {
    const getIcon = () => {
        switch (item.type) {
            case 'folder':
                return (
                    <Folder className="h-4.5 w-4.5 fill-blue-500/20 text-blue-500" />
                );
            case 'document':
                return <FileText className="h-4.5 w-4.5 text-gray-500" />;
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
                return <File className="h-4.5 w-4.5 text-gray-400" />;
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
        onNavigate?.(item);
    };

    return (
        <div
            style={style}
            className="group absolute top-0 left-0 flex h-14 w-full items-center border-b border-gray-50 bg-white px-6 transition-colors hover:bg-gray-50/80"
        >
            {/* Name Column */}
            <div
                className={`flex min-w-0 flex-1 items-center gap-3 pr-4 ${item.isDirectory ? 'cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-200' : ''}`}
                onClick={() => item.isDirectory && onNavigate?.(item)}
                onKeyDown={handleFolderKeyDown}
                role={item.isDirectory ? 'button' : undefined}
                tabIndex={item.isDirectory ? 0 : undefined}
            >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-50 group-hover:bg-white">
                    {getIcon()}
                </div>
                <span className="truncate text-sm font-semibold text-gray-900 transition-colors group-hover:text-blue-600">
                    {item.name}
                </span>
            </div>

            {/* Size Column */}
            <div className="w-32 shrink-0 pr-4 text-xs font-medium text-gray-500">
                {item.isDirectory ? '--' : formatBytes(item.size)}
            </div>

            {/* Type Column */}
            <div className="w-32 shrink-0 pr-4 text-xs font-medium text-gray-500 capitalize">
                {item.type}
            </div>

            {/* Date Column */}
            <div className="w-32 shrink-0 pr-4 text-xs font-medium text-gray-500">
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
                                    className="h-8 w-8 rounded-lg text-gray-400 hover:text-gray-900"
                                    aria-label={`Share ${item.name}`}
                                >
                                    <Share2 className="h-4 w-4" />
                                </Button>
                            )}
                            {capabilities?.download && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 rounded-lg text-gray-400 hover:text-gray-900"
                                    aria-label={`Download ${item.name}`}
                                >
                                    <Download className="h-4 w-4" />
                                </Button>
                            )}
                            {capabilities?.delete && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 rounded-lg text-gray-400 hover:text-red-600"
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
