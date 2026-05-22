import {
    Folder,
    FileText,
    FileImage,
    FileCode,
    FileArchive,
    FileVideo,
    FileAudio,
    File,
    MoreHorizontal,
    Download,
    Trash2,
    Share2
} from 'lucide-react';
import { Button } from './ui/button';

export interface FileItemProps {
    id: string | number;
    name: string;
    type: 'folder' | 'document' | 'image' | 'code' | 'archive' | 'video' | 'audio' | 'other';
    size: number;
    updatedAt: string;
}

export function FileTableRow({ item, style }: { item: FileItemProps; style: React.CSSProperties }) {
    const getIcon = () => {
        switch (item.type) {
            case 'folder': return <Folder className="h-4.5 w-4.5 text-blue-500 fill-blue-500/20" />;
            case 'document': return <FileText className="h-4.5 w-4.5 text-gray-500" />;
            case 'image': return <FileImage className="h-4.5 w-4.5 text-emerald-500" />;
            case 'code': return <FileCode className="h-4.5 w-4.5 text-amber-500" />;
            case 'archive': return <FileArchive className="h-4.5 w-4.5 text-red-500" />;
            case 'video': return <FileVideo className="h-4.5 w-4.5 text-purple-500" />;
            case 'audio': return <FileAudio className="h-4.5 w-4.5 text-pink-500" />;
            default: return <File className="h-4.5 w-4.5 text-gray-400" />;
        }
    };

    const formatSize = (bytes: number) => {
        if (bytes === 0) return '--';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    return (
        <div 
            style={style} 
            className="group absolute top-0 left-0 flex h-14 w-full items-center border-b border-gray-100/50 bg-white px-6 transition-colors hover:bg-gray-50/80"
        >
            {/* Name Column */}
            <div className="flex flex-1 min-w-0 items-center gap-3 pr-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-50 group-hover:bg-white">
                    {getIcon()}
                </div>
                <span className="truncate text-sm font-semibold text-gray-900 transition-colors group-hover:text-blue-600 cursor-pointer">
                    {item.name}
                </span>
            </div>

            {/* Size Column */}
            <div className="w-32 shrink-0 pr-4 text-xs font-medium text-gray-500">
                {item.type === 'folder' ? '--' : formatSize(item.size)}
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
                <div className="flex opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-gray-400 hover:text-gray-900">
                        <Share2 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-gray-400 hover:text-gray-900">
                        <Download className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-gray-400 hover:text-red-600">
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-gray-400 opacity-100 group-hover:opacity-0 absolute right-6">
                    <MoreHorizontal className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
}
