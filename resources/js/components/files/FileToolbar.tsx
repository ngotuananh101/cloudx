import { FolderPlus, Search, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { ProviderCapabilities } from '@/types/cloud';

interface FileToolbarProps {
    decodedPath?: string | null;
    searchQuery: string;
    setSearchQuery: (value: string) => void;
    capabilities?: ProviderCapabilities;
}

export function FileToolbar({ decodedPath, searchQuery, setSearchQuery, capabilities }: FileToolbarProps) {
    return (
        <div className="mb-3 flex flex-col items-center gap-3 rounded-2xl border border-gray-100/50 bg-white p-2.5 shadow-sm sm:flex-row">
            <div className="relative w-full flex-1">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                    <Search className="h-4 w-4 text-gray-400" />
                </div>
                <Input
                    type="text"
                    placeholder={`Search in ${decodedPath ? decodedPath.split('/').pop() : 'My Files'}...`}
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    className="h-11 w-full rounded-xl border-none bg-gray-50/50 pl-11 font-semibold text-gray-900 placeholder:text-gray-400 focus-visible:ring-1 focus-visible:ring-gray-200"
                />
            </div>
            <div className="flex w-full items-center justify-end gap-2 sm:w-auto sm:shrink-0">
                {capabilities?.createFolder && (
                    <Button
                        variant="outline"
                        className="h-11 rounded-xl border-gray-200 font-bold tracking-wide text-gray-700 shadow-sm transition-all hover:bg-gray-50 hover:text-gray-900"
                    >
                        <FolderPlus className="h-4 w-4" />
                        New Folder
                    </Button>
                )}
                {capabilities?.upload && (
                    <Button className="h-11 rounded-xl bg-[#bd1e24] font-bold tracking-wide text-white shadow-sm transition-all duration-300 hover:bg-[#a0181e]">
                        <Upload className="h-4 w-4" />
                        Upload
                    </Button>
                )}
            </div>
        </div>
    );
}
