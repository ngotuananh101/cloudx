import {
    Download,
    FileCode,
    FileText,
    FolderPlus,
    Link as LinkIcon,
    Trash2,
    Unlink,
    Upload,
} from 'lucide-react';
import type { ComponentType } from 'react';

const ACTION_ICONS: Record<string, ComponentType<{ className?: string }>> = {
    upload: Upload,
    'file-code': FileCode,
    trash: Trash2,
    'folder-plus': FolderPlus,
    'file-text': FileText,
    link: LinkIcon,
    unlink: Unlink,
    download: Download,
};

export function ActivityIcon({ icon }: { icon: string }) {
    const Icon = ACTION_ICONS[icon] ?? FileText;

    return <Icon className="h-6 w-6" />;
}

/**
 * Human-readable summary of what an activity's action was applied to,
 * e.g. the destination for a move, or the connection for a share/connect.
 */
export function describeActivity(log: {
    action: { key: string };
    source_name: string | null;
    target_name: string | null;
    connection: { name: string } | null;
}): string {
    switch (log.action.key) {
        case 'FileMoved':
            return `${log.source_name ?? '/'} → ${log.target_name ?? '/'}`;
        case 'ConnectionCreated':
        case 'ConnectionDeleted':
            return log.connection?.name ?? log.target_name ?? '';
        default:
            return log.target_name ?? log.connection?.name ?? '';
    }
}
