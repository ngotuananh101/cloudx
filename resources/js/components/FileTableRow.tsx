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
    ArrowRightLeft,
} from 'lucide-react';
import type { CSSProperties, KeyboardEvent } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { encodeCloudPath } from '@/lib/cloud-path';
import { formatBytes } from '@/lib/format-bytes';
import type { CloudFile, ProviderCapabilities } from '@/types/cloud';
import { Button } from './ui/button';
import files from '@/routes/cloud/files';

interface FileTableRowProps {
    item: CloudFile;
    style: CSSProperties;
    capabilities?: ProviderCapabilities;
    onNavigate?: (item: CloudFile) => void;
    onPreview?: (item: CloudFile) => void;
    onMove?: (item: CloudFile) => void;
    onShare?: (item: CloudFile) => void;
    onDelete?: (item: CloudFile) => void;
    isSelected?: boolean;
    onSelect?: (item: CloudFile, selected: boolean) => void;
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
    isSelected = false,
    onSelect,
    connectionId,
}: FileTableRowProps) {
    const getIcon = () => {
        switch (item.type) {
            case 'folder':
                return (
                    <Folder className="h-4.5 w-4.5 fill-primary/20 text-primary" />
                );
            case 'document':
                return (
                    <FileText className="h-4.5 w-4.5 text-muted-foreground" />
                );
            case 'image':
                return <FileImage className="h-4.5 w-4.5 text-primary" />;
            case 'code':
                return (
                    <FileCode className="h-4.5 w-4.5 text-muted-foreground" />
                );
            case 'archive':
                return <FileArchive className="h-4.5 w-4.5 text-destructive" />;
            case 'video':
                return <FileVideo className="h-4.5 w-4.5 text-purple-500" />;
            case 'audio':
                return <FileAudio className="h-4.5 w-4.5 text-primary" />;
            default:
                return <File className="h-4.5 w-4.5 text-muted-foreground" />;
        }
    };

    const hasActions = Boolean(
        capabilities?.share ||
        capabilities?.move ||
        capabilities?.download ||
        capabilities?.delete,
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

        globalThis.location.href = url;
    };

    return (
        <div
            style={style}
            className="group absolute top-0 left-0 flex h-12 w-full items-center border-b border-border bg-card pr-6 pl-4 transition-colors hover:bg-muted data-[selected=true]:bg-primary/5"
            data-selected={isSelected}
        >
            <div className="flex w-10 shrink-0 items-center justify-start">
                <Checkbox
                    checked={isSelected}
                    onCheckedChange={(checked) =>
                        onSelect?.(item, checked === true)
                    }
                    onClick={(event) => event.stopPropagation()}
                    aria-label={`Select ${item.name}`}
                />
            </div>

            {/* Name Column */}
            <div
                className={`flex min-w-0 flex-1 cursor-pointer items-center gap-3 pr-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring`}
                onClick={() =>
                    item.isDirectory ? onNavigate?.(item) : onPreview?.(item)
                }
                onKeyDown={handleFolderKeyDown}
                role="button"
                tabIndex={0}
            >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted group-hover:bg-card">
                    {getIcon()}
                </div>
                <span className="truncate text-sm font-medium text-foreground transition-colors group-hover:text-primary">
                    {item.name}
                </span>
            </div>

            {/* Size Column */}
            <div className="w-32 shrink-0 pr-4 text-xs font-medium text-muted-foreground">
                {item.isDirectory ? '--' : formatBytes(item.size)}
            </div>

            {/* Type Column */}
            <div className="w-32 shrink-0 pr-4 text-xs font-medium text-muted-foreground capitalize">
                {item.type}
            </div>

            {/* Date Column */}
            <div className="w-32 shrink-0 pr-4 text-xs font-medium text-muted-foreground">
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
                                    className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground"
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
                                    className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground"
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
                                    className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground"
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
                                    className="h-8 w-8 rounded-lg text-muted-foreground hover:text-destructive"
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
