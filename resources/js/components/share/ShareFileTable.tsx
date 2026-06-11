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
            return <Folder className="h-4 w-4 fill-blue-500/20 text-blue-500 dark:fill-blue-500/30 dark:text-blue-400" />;
        case 'document':
            return <FileText className="h-4 w-4 text-gray-500 dark:text-gray-400" />;
        case 'image':
            return <FileImage className="h-4 w-4 text-emerald-500" />;
        case 'code':
            return <FileCode className="h-4 w-4 text-amber-500" />;
        case 'archive':
            return <FileArchive className="h-4 w-4 text-red-500" />;
        case 'video':
            return <FileVideo className="h-4 w-4 text-purple-500" />;
        case 'audio':
            return <FileAudio className="h-4 w-4 text-pink-500" />;
        default:
            return <File className="h-4 w-4 text-gray-400 dark:text-gray-500" />;
    }
}

export function ShareFileTable({ files, shareUuid, onNavigate, onPreview }: ShareFileTableProps) {
    const handleDownload = (file: CloudFile) => {
        const encodedPath = encodeCloudPath(file.path);
        window.location.href = `/s/${shareUuid}/download/${encodedPath}`;
    };

    if (files.length === 0) {
        return (
            <div className="py-12 text-center text-sm text-gray-400 dark:text-gray-500">
                This folder is empty.
            </div>
        );
    }

    return (
        <div className="overflow-hidden rounded-xl border border-gray-100 dark:border-gray-800">
            <table className="w-full">
                <thead>
                    <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50">
                        <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                            Name
                        </th>
                        <th className="w-28 px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                            Size
                        </th>
                        <th className="w-16 px-4 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {files.map((file) => (
                        <tr
                            key={file.id}
                            className="group border-b border-gray-50 dark:border-gray-800 last:border-b-0 bg-white dark:bg-gray-900 transition-colors hover:bg-gray-50/80 dark:hover:bg-gray-800/80"
                        >
                            <td className="px-4 py-2.5">
                                <div
                                    className={`flex min-w-0 items-center gap-3 ${file.isDirectory ? 'cursor-pointer' : ''}`}
                                    onClick={() => file.isDirectory ? onNavigate(file) : onPreview(file)}
                                    role={file.isDirectory ? 'button' : undefined}
                                    tabIndex={file.isDirectory ? 0 : undefined}
                                    onKeyDown={(e) => {
                                        if (file.isDirectory && (e.key === 'Enter' || e.key === ' ')) {
                                            e.preventDefault();
                                            onNavigate(file);
                                        }
                                    }}
                                >
                                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-50 dark:bg-gray-800">
                                        {getFileIcon(file.type)}
                                    </div>
                                    <span className={`truncate text-sm font-medium ${
                                        file.isDirectory
                                            ? 'text-blue-600 dark:text-blue-400 hover:underline'
                                            : 'text-gray-900 dark:text-gray-100'
                                    }`}>
                                        {file.name}
                                    </span>
                                </div>
                            </td>
                            <td className="px-4 py-2.5 text-right text-xs text-gray-500 dark:text-gray-400">
                                {file.isDirectory ? '--' : formatBytes(file.size)}
                            </td>
                            <td className="px-4 py-2.5 text-center">
                                {!file.isDirectory && (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
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
