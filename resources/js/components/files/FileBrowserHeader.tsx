import { ChevronRight, Home } from 'lucide-react';
import type { CloudConnection } from '@/types/cloud';

interface FileBrowserHeaderProps {
    connection: CloudConnection;
    decodedPath?: string | null;
    onNavigateHome: () => void;
}

export function FileBrowserHeader({
    connection,
    decodedPath,
    onNavigateHome,
}: FileBrowserHeaderProps) {
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
                    {decodedPath ? (
                        <>
                            <button
                                type="button"
                                onClick={onNavigateHome}
                                className="text-2xl font-extrabold tracking-tight text-gray-400 transition-colors hover:text-gray-900"
                                aria-label="Go to root folder"
                            >
                                <Home className="h-5 w-5" />
                            </button>
                            <span className="text-lg font-medium text-gray-300">
                                /
                            </span>
                            <h2 className="max-w-md truncate text-lg font-medium tracking-tight text-gray-900">
                                {decodedPath.split('/').pop() || decodedPath}
                            </h2>
                        </>
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
