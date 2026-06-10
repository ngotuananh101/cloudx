import { ChevronRight, Home } from 'lucide-react';

interface ShareBreadcrumbProps {
    /** The share's root folder name */
    shareName: string;
    /** Current decoded path inside the share */
    currentPath: string;
    /** The share's base path (root of the share) */
    shareBasePath: string;
    onNavigate: (path: string | null) => void;
}

interface BreadcrumbSegment {
    label: string;
    path: string;
}

export function ShareBreadcrumb({
    shareName,
    currentPath,
    shareBasePath,
    onNavigate,
}: ShareBreadcrumbProps) {
    // Build segments relative to share root
    const relativePath = currentPath.startsWith(shareBasePath)
        ? currentPath.slice(shareBasePath.length).replace(/^\//, '')
        : '';

    const segments: BreadcrumbSegment[] = relativePath
        .split('/')
        .filter(Boolean)
        .map((label, index, arr) => ({
            label,
            path: `${shareBasePath}/${arr.slice(0, index + 1).join('/')}`,
        }));

    const isAtRoot = segments.length === 0;

    return (
        <div className="flex items-center gap-1.5 text-sm">
            <button
                type="button"
                onClick={() => onNavigate(null)}
                className={`flex items-center gap-1 transition-colors ${
                    isAtRoot
                        ? 'font-semibold text-gray-900 dark:text-gray-100'
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                }`}
            >
                <Home className="h-4 w-4" />
                <span className="truncate">{shareName}</span>
            </button>

            {segments.map((segment, index) => {
                const isLast = index === segments.length - 1;

                return (
                    <div key={segment.path} className="flex items-center gap-1.5">
                        <ChevronRight className="h-3.5 w-3.5 text-gray-300 dark:text-gray-600" />
                        {isLast ? (
                            <span className="truncate font-semibold text-gray-900 dark:text-gray-100">
                                {segment.label}
                            </span>
                        ) : (
                            <button
                                type="button"
                                onClick={() => onNavigate(segment.path)}
                                className="truncate text-gray-500 dark:text-gray-400 transition-colors hover:text-gray-900 dark:hover:text-gray-100"
                            >
                                {segment.label}
                            </button>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
