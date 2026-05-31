import { ChevronRight, Home, MoreHorizontal } from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { CloudConnection } from '@/types/cloud';

interface FileBrowserHeaderProps {
    connection: CloudConnection;
    decodedPath?: string | null;
    onNavigateHome: () => void;
    onNavigatePath: (path: string) => void;
}

interface BreadcrumbSegment {
    label: string;
    path: string;
}

function breadcrumbSegments(decodedPath?: string | null): BreadcrumbSegment[] {
    return (decodedPath ?? '')
        .split('/')
        .map((segment) => segment.trim())
        .filter(Boolean)
        .map((label, index, segments) => ({
            label,
            path: segments.slice(0, index + 1).join('/'),
        }));
}

export function FileBrowserHeader({
    connection,
    decodedPath,
    onNavigateHome,
    onNavigatePath,
}: FileBrowserHeaderProps) {
    const segments = breadcrumbSegments(decodedPath);
    const hiddenSegments = segments.slice(0, -3);
    const visibleSegments = segments.slice(-3);
    const hasHiddenSegments = hiddenSegments.length > 0;

    return (
        <div className="mb-3 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
                <div className="flex items-center text-[10px] font-extrabold tracking-widest text-gray-400">
                    <span className="uppercase">
                        {connection?.name || 'WORKSPACE'}
                    </span>
                    <ChevronRight className="mx-1 h-3 w-3" />
                    <span className="uppercase">FILES</span>
                </div>
                <div className="mt-1 flex items-center gap-2">
                    {segments.length > 0 ? (
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                            <button
                                type="button"
                                onClick={onNavigateHome}
                                className="text-2xl font-extrabold tracking-tight text-gray-400 transition-colors hover:text-gray-900"
                                aria-label="Go to root folder"
                            >
                                <Home className="h-5 w-5" />
                            </button>

                            {hasHiddenSegments && (
                                <>
                                    <span className="text-lg text-gray-300">
                                        /
                                    </span>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <button
                                                type="button"
                                                className="inline-flex h-7 items-center rounded-md px-1.5 text-gray-400 transition-colors hover:bg-gray-50 hover:text-gray-900"
                                                aria-label="Show hidden breadcrumb folders"
                                            >
                                                <MoreHorizontal className="h-5 w-5" />
                                            </button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent
                                            align="start"
                                            className="w-56"
                                        >
                                            {hiddenSegments.map((segment) => (
                                                <DropdownMenuItem
                                                    key={segment.path}
                                                    onSelect={() =>
                                                        onNavigatePath(
                                                            segment.path,
                                                        )
                                                    }
                                                >
                                                    <span className="truncate">
                                                        {segment.label}
                                                    </span>
                                                </DropdownMenuItem>
                                            ))}
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </>
                            )}

                            {visibleSegments.map((segment, index) => {
                                const isLast =
                                    index === visibleSegments.length - 1;

                                return (
                                    <div
                                        key={segment.path}
                                        className="flex min-w-0 items-center gap-2"
                                    >
                                        <span className="text-lg text-gray-300">
                                            /
                                        </span>
                                        {isLast ? (
                                            <h2 className="max-w-[18rem] truncate text-lg font-medium tracking-tight text-gray-900">
                                                {segment.label}
                                            </h2>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    onNavigatePath(segment.path)
                                                }
                                                className="max-w-40 truncate text-lg text-gray-500 transition-colors hover:text-gray-900"
                                            >
                                                {segment.label}
                                            </button>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <h2 className="text-xl font-extrabold tracking-tight text-gray-900">
                            My Files
                        </h2>
                    )}
                </div>
            </div>
        </div>
    );
}
