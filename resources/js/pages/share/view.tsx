import { Head, router } from '@inertiajs/react';
import {
    Download,
    File,
    FileArchive,
    FileAudio,
    FileCode,
    FileImage,
    FileText,
    FileVideo,
    Folder,
    Clock,
    Globe,
    Lock,
} from 'lucide-react';
import { useState } from 'react';
import ShareLayout from '@/layouts/ShareLayout';
import { Button } from '@/components/ui/button';
import { ShareBreadcrumb } from '@/components/share/ShareBreadcrumb';
import { ShareFileTable } from '@/components/share/ShareFileTable';
import { SharePreview } from '@/components/share/SharePreview';
import { encodeCloudPath } from '@/lib/cloud-path';
import { formatBytes } from '@/lib/format-bytes';
import type { CloudFile } from '@/types/cloud';

interface ShareViewProps {
    share: {
        uuid: string;
        name: string;
        type: 'public' | 'password';
        expires_at: string | null;
        created_at: string;
        is_directory: boolean;
        user_name: string | null;
    };
    isDirectory: boolean;
    files: CloudFile[];
    file: {
        name: string;
        path: string;
        size: number;
        type: string;
    } | null;
    currentPath: string;
    shareBasePath: string;
    previewUrl: string | null;
    downloadUrl: string | null;
}

function getLargeIcon(type: string, isDirectory: boolean) {
    if (isDirectory) {
        return { icon: Folder, bg: 'bg-amber-50 dark:bg-amber-950', color: 'text-amber-500' };
    }
    switch (type) {
        case 'image':
            return { icon: FileImage, bg: 'bg-emerald-50 dark:bg-emerald-950', color: 'text-emerald-500' };
        case 'video':
            return { icon: FileVideo, bg: 'bg-purple-50 dark:bg-purple-950', color: 'text-purple-500' };
        case 'audio':
            return { icon: FileAudio, bg: 'bg-pink-50 dark:bg-pink-950', color: 'text-pink-500' };
        case 'code':
            return { icon: FileCode, bg: 'bg-blue-50 dark:bg-blue-950', color: 'text-blue-500' };
        case 'archive':
            return { icon: FileArchive, bg: 'bg-red-50 dark:bg-red-950', color: 'text-red-500' };
        case 'document':
            return { icon: FileText, bg: 'bg-gray-100 dark:bg-gray-800', color: 'text-gray-500' };
        default:
            return { icon: File, bg: 'bg-gray-100 dark:bg-gray-800', color: 'text-gray-400' };
    }
}

export default function ShareView({
    share,
    isDirectory,
    files,
    file,
    currentPath,
    shareBasePath,
    previewUrl,
    downloadUrl,
}: ShareViewProps) {
    const [previewingFile, setPreviewingFile] = useState<CloudFile | null>(null);

    const handleNavigateFolder = (folderFile: CloudFile) => {
        const encodedPath = encodeCloudPath(folderFile.path);
        router.visit(`/s/${share.uuid}?path=${encodedPath}`);
    };

    const handleBreadcrumbNavigate = (path: string | null) => {
        if (path === null) {
            router.visit(`/s/${share.uuid}`);
        } else {
            const encodedPath = encodeCloudPath(path);
            router.visit(`/s/${share.uuid}?path=${encodedPath}`);
        }
    };

    const handlePreviewFile = (fileItem: CloudFile) => {
        setPreviewingFile(fileItem);
    };

    const totalSize = isDirectory
        ? files.reduce((sum, f) => sum + (f.isDirectory ? 0 : f.size), 0)
        : 0;

    const iconConfig = isDirectory
        ? getLargeIcon('folder', true)
        : getLargeIcon(file?.type ?? 'other', false);
    const IconComponent = iconConfig.icon;

    const handleDownload = () => {
        if (!file || !downloadUrl) {
            return;
        }
        window.location.href = downloadUrl;
    };

    const handleDownloadFolderFile = (fileItem: CloudFile) => {
        const encodedPath = encodeCloudPath(fileItem.path);
        window.location.href = `/s/${share.uuid}/download/${encodedPath}`;
    };

    const isAtRoot = currentPath === shareBasePath || currentPath === '';

    return (
        <ShareLayout>
            <Head title={`${share.name} — Shared`} />

            <div className="w-full max-w-2xl rounded-2xl bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:bg-gray-900">
                {/* Header with badge */}
                <div className="flex items-center justify-between border-b border-gray-100 px-6 py-3 dark:border-gray-800">
                    <span className="text-sm font-bold tracking-tight text-brand">
                        CloudX
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                        {share.type === 'public' ? (
                            <>
                                <Globe className="h-3 w-3" />
                                Public
                            </>
                        ) : (
                            <>
                                <Lock className="h-3 w-3" />
                                Protected
                            </>
                        )}
                    </span>
                </div>

                {/* Body */}
                <div className="px-6 py-8">
                    {/* Shared info */}
                    <div className="mb-6 flex items-center justify-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                        {share.user_name && (
                            <>
                                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-brand text-[10px] font-bold text-white">
                                    {share.user_name.charAt(0).toUpperCase()}
                                </div>
                                <span>
                                    Shared by <strong className="text-gray-700 dark:text-gray-300">{share.user_name}</strong>
                                </span>
                                <span>•</span>
                            </>
                        )}
                        {share.expires_at ? (
                            <span className="inline-flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                Expires {new Date(share.expires_at).toLocaleDateString()}
                            </span>
                        ) : (
                            <span>No expiry</span>
                        )}
                    </div>

                    {/* Breadcrumb for folders */}
                    {isDirectory && !isAtRoot && (
                        <div className="mb-4">
                            <ShareBreadcrumb
                                shareName={share.name}
                                currentPath={currentPath}
                                shareBasePath={shareBasePath}
                                onNavigate={handleBreadcrumbNavigate}
                            />
                        </div>
                    )}

                    {/* File/Folder hero */}
                    <div className="mb-6 text-center">
                        <div className={`mx-auto mb-4 flex h-[72px] w-[72px] items-center justify-center rounded-2xl ${iconConfig.bg}`}>
                            <IconComponent className={`h-8 w-8 ${iconConfig.color}`} />
                        </div>
                        <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                            {isDirectory && !isAtRoot
                                ? currentPath.split('/').pop()
                                : share.name}
                        </h1>
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                            {isDirectory
                                ? `${files.length} items • ${formatBytes(totalSize)} total`
                                : `${formatBytes(file?.size ?? 0)} • ${file?.type ?? 'file'}`}
                        </p>
                    </div>

                    {/* Action buttons */}
                    <div className="mb-6 flex justify-center gap-3">
                        {!isDirectory && (
                            <>
                                <Button
                                    onClick={handleDownload}
                                    className="bg-blue-600 text-white hover:bg-blue-700"
                                >
                                    <Download className="mr-2 h-4 w-4" />
                                    Download
                                </Button>
                            </>
                        )}
                        {isDirectory && files.length > 0 && (
                            <Button
                                onClick={() => {
                                    // Download each file individually
                                    const downloadableFiles = files.filter((f) => !f.isDirectory);
                                    downloadableFiles.forEach((f) => handleDownloadFolderFile(f));
                                }}
                                className="bg-blue-600 text-white hover:bg-blue-700"
                            >
                                <Download className="mr-2 h-4 w-4" />
                                Download All
                            </Button>
                        )}
                    </div>

                    {/* Preview area for single file */}
                    {!isDirectory && previewUrl && downloadUrl && file && (
                        <SharePreview
                            previewUrl={previewUrl}
                            fileName={file.name}
                            fileSize={file.size}
                            downloadUrl={downloadUrl}
                        />
                    )}

                    {/* Preview area for file inside folder */}
                    {previewingFile && (
                        <div className="mb-6">
                            <SharePreview
                                previewUrl={`/s/${share.uuid}/preview/${encodeCloudPath(previewingFile.path)}`}
                                fileName={previewingFile.name}
                                fileSize={previewingFile.size}
                                downloadUrl={`/s/${share.uuid}/download/${encodeCloudPath(previewingFile.path)}`}
                            />
                        </div>
                    )}

                    {/* File table for folders */}
                    {isDirectory && (
                        <ShareFileTable
                            files={files}
                            shareUuid={share.uuid}
                            onNavigate={handleNavigateFolder}
                            onPreview={handlePreviewFile}
                        />
                    )}
                </div>
            </div>
        </ShareLayout>
    );
}
