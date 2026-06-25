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
import { ShareBreadcrumb } from '@/components/share/ShareBreadcrumb';
import { ShareFileTable } from '@/components/share/ShareFileTable';
import { SharePreview } from '@/components/share/SharePreview';
import { Button } from '@/components/ui/button';
import ShareLayout from '@/layouts/ShareLayout';
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
        return { icon: Folder, bg: 'bg-muted', color: 'text-primary' };
    }

    switch (type) {
        case 'image':
            return { icon: FileImage, bg: 'bg-muted', color: 'text-primary' };
        case 'video':
            return { icon: FileVideo, bg: 'bg-muted', color: 'text-primary' };
        case 'audio':
            return { icon: FileAudio, bg: 'bg-muted', color: 'text-primary' };
        case 'code':
            return { icon: FileCode, bg: 'bg-muted', color: 'text-primary' };
        case 'archive':
            return { icon: FileArchive, bg: 'bg-muted', color: 'text-primary' };
        case 'document':
            return {
                icon: FileText,
                bg: 'bg-muted',
                color: 'text-muted-foreground',
            };
        default:
            return {
                icon: File,
                bg: 'bg-muted',
                color: 'text-muted-foreground',
            };
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
    const [previewingFile, setPreviewingFile] = useState<CloudFile | null>(
        null,
    );

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

    const isAtRoot = currentPath === shareBasePath || currentPath === '';

    return (
        <ShareLayout>
            <Head title={`${share.name} — Shared`} />

            <div className="w-full max-w-2xl rounded-2xl bg-card shadow-sm">
                {/* Header with badge */}
                <div className="flex items-center justify-between border-b border-border px-6 py-3">
                    <span className="text-sm font-bold tracking-tight text-primary">
                        CloudX
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
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
                    <div className="mb-6 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                        {share.user_name && (
                            <>
                                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                                    {share.user_name.charAt(0).toUpperCase()}
                                </div>
                                <span>
                                    Shared by{' '}
                                    <strong className="text-foreground">
                                        {share.user_name}
                                    </strong>
                                </span>
                                <span>•</span>
                            </>
                        )}
                        {share.expires_at ? (
                            <span className="inline-flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                Expires{' '}
                                {new Date(
                                    share.expires_at,
                                ).toLocaleDateString()}
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
                        <div
                            className={`mx-auto mb-4 flex h-18 w-18 items-center justify-center rounded-2xl ${iconConfig.bg}`}
                        >
                            <IconComponent
                                className={`h-8 w-8 ${iconConfig.color}`}
                            />
                        </div>
                        <h1 className="text-lg font-bold text-foreground">
                            {isDirectory && !isAtRoot
                                ? currentPath.split('/').pop()
                                : share.name}
                        </h1>
                        <p className="mt-1 text-sm text-muted-foreground">
                            {isDirectory
                                ? `${files.length} items • ${formatBytes(totalSize)} total`
                                : `${formatBytes(file?.size ?? 0)} • ${file?.type ?? 'file'}`}
                        </p>
                    </div>

                    {/* Action buttons */}
                    {!isDirectory && (
                        <div className="mb-6 flex justify-center gap-3">
                            <Button
                                onClick={handleDownload}
                                className="bg-primary text-primary-foreground hover:bg-primary/90"
                            >
                                <Download className="mr-2 h-4 w-4" />
                                Download
                            </Button>
                        </div>
                    )}

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
