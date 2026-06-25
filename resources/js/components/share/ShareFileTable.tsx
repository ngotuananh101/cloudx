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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { encodeCloudPath } from '@/lib/cloud-path';
import { formatBytes } from '@/lib/format-bytes';
import type { CloudFile } from '@/types/cloud';

interface ShareFileTableProps {
    files: CloudFile[];
    shareUuid: string;
    onNavigate: (file: CloudFile) => void;
    onPreview: (file: CloudFile) => void;
}

function getFileIcon(type: string) {
    switch (type) {
        case 'folder':
            return <Folder className="h-4 w-4 fill-primary/20 text-primary" />;
        case 'document':
            return <FileText className="h-4 w-4 text-muted-foreground" />;
        case 'image':
            return <FileImage className="h-4 w-4 text-primary" />;
        case 'code':
            return <FileCode className="h-4 w-4 text-muted-foreground" />;
        case 'archive':
            return <FileArchive className="h-4 w-4 text-destructive" />;
        case 'video':
            return <FileVideo className="h-4 w-4 text-purple-500" />;
        case 'audio':
            return <FileAudio className="h-4 w-4 text-primary" />;
        default:
            return <File className="h-4 w-4 text-muted-foreground" />;
    }
}

export function ShareFileTable({
    files,
    shareUuid,
    onNavigate,
    onPreview,
}: ShareFileTableProps) {
    const handleDownload = (file: CloudFile) => {
        const encodedPath = encodeCloudPath(file.path);
        window.location.href = `/s/${shareUuid}/download/${encodedPath}`;
    };

    if (files.length === 0) {
        return (
            <div className="py-12 text-center text-sm text-muted-foreground">
                This folder is empty.
            </div>
        );
    }

    return (
        <div className="overflow-hidden rounded-xl border border-border">
            <table className="w-full">
                <thead>
                    <tr className="border-b border-border bg-muted/50">
                        <th className="px-4 py-2.5 text-left text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                            Name
                        </th>
                        <th className="w-28 px-4 py-2.5 text-right text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                            Size
                        </th>
                        <th className="w-16 px-4 py-2.5 text-center text-[11px] font-semibold tracking-wider text-muted-foreground uppercase"></th>
                    </tr>
                </thead>
                <tbody>
                    {files.map((file) => (
                        <tr
                            key={file.id}
                            className="group border-b border-border bg-card transition-colors last:border-b-0 hover:bg-muted"
                        >
                            <td className="px-4 py-2.5">
                                <div
                                    className={`flex min-w-0 items-center gap-3 ${file.isDirectory ? 'cursor-pointer' : ''}`}
                                    onClick={() =>
                                        file.isDirectory
                                            ? onNavigate(file)
                                            : onPreview(file)
                                    }
                                    role={
                                        file.isDirectory ? 'button' : undefined
                                    }
                                    tabIndex={file.isDirectory ? 0 : undefined}
                                    onKeyDown={(e) => {
                                        if (
                                            file.isDirectory &&
                                            (e.key === 'Enter' || e.key === ' ')
                                        ) {
                                            e.preventDefault();
                                            onNavigate(file);
                                        }
                                    }}
                                >
                                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                                        {getFileIcon(file.type)}
                                    </div>
                                    <span
                                        className={`truncate text-sm font-medium ${
                                            file.isDirectory
                                                ? 'text-primary hover:underline'
                                                : 'text-foreground'
                                        }`}
                                    >
                                        {file.name}
                                    </span>
                                </div>
                            </td>
                            <td className="px-4 py-2.5 text-right text-xs text-muted-foreground">
                                {file.isDirectory
                                    ? '--'
                                    : formatBytes(file.size)}
                            </td>
                            <td className="px-4 py-2.5 text-center">
                                {!file.isDirectory && (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 text-muted-foreground hover:text-primary"
                                        onClick={() => handleDownload(file)}
                                        aria-label={`Download ${file.name}`}
                                    >
                                        <Download className="h-3.5 w-3.5" />
                                    </Button>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
