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

export function FileToolbar({
    decodedPath,
    searchQuery,
    setSearchQuery,
    capabilities,
}: FileToolbarProps) {
    return (
        <div className="mb-3 flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-2.5 shadow-sm sm:flex-row">
            <div className="relative w-full flex-1">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                    <Search className="h-4 w-4 text-muted-foreground" />
                </div>
                <Input
                    type="text"
                    placeholder={`Search in ${decodedPath ? decodedPath.split('/').pop() : 'My Files'}...`}
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    className="h-11 w-full rounded-xl border-none bg-muted/50 pl-11 font-semibold text-foreground placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring"
                />
            </div>
            <div className="flex w-full items-center justify-end gap-2 sm:w-auto sm:shrink-0">
                {capabilities?.createFolder && (
                    <Button
                        variant="outline"
                        className="h-11 rounded-xl border-border font-bold tracking-wide text-foreground shadow-sm transition-all hover:bg-muted hover:text-foreground"
                    >
                        <FolderPlus className="h-4 w-4" />
                        New Folder
                    </Button>
                )}
                {capabilities?.upload && (
                    <Button className="h-11 rounded-xl bg-primary font-bold tracking-wide text-white shadow-sm transition-all duration-300 hover:bg-primary/90">
                        <Upload className="h-4 w-4" />
                        Upload
                    </Button>
                )}
            </div>
        </div>
    );
}
