import { Head, router } from '@inertiajs/react';
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef, useState, useMemo } from 'react';
import { FileTableRow, FileItemProps } from '@/components/FileTableRow';
import { Button } from '@/components/ui/button';
import { Upload, FolderPlus, Search, Filter, ChevronRight, Home } from 'lucide-react';
import { Input } from '@/components/ui/input';

export default function FileBrowser({ connection, currentPath, decodedPath, files }: any) {
    const [searchQuery, setSearchQuery] = useState('');

    const filteredFiles = useMemo(() => {
        if (!searchQuery) return files || [];
        return (files || []).filter((f: any) => f.name.toLowerCase().includes(searchQuery.toLowerCase()));
    }, [files, searchQuery]);

    const parentRef = useRef<HTMLDivElement>(null);

    const rowVirtualizer = useVirtualizer({
        count: filteredFiles.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 56, // Fixed height for table rows
        overscan: 15,
    });

    const handleNavigate = (item: FileItemProps) => {
        if (item.type === 'folder') {
            const str = item.id.toString();
            // Encode unicode string to base64 safely
            const base64 = btoa(
                encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (match, p1) => 
                    String.fromCharCode(parseInt(p1, 16))
                )
            );
            const encodedPath = base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
            router.visit(`/s/${connection.id}/${encodedPath}`);
        }
    };

    const handleNavigateHome = () => {
        router.visit(`/s/${connection.id}`);
    };

    return (
        <AuthenticatedLayout title="Files">
            <Head title="Files & Folders" />

            {/* Header & Controls */}
            <div className="mb-3 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <div className="flex items-center text-[10px] font-extrabold tracking-widest text-gray-400">
                        <span className="uppercase">{connection?.name || 'WORKSPACE'}</span>
                        <ChevronRight className="mx-1 h-3 w-3" />
                        <span className="uppercase">FILES</span>
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                        {decodedPath ? (
                            <>
                                <button onClick={handleNavigateHome} className="text-2xl font-extrabold tracking-tight text-gray-400 hover:text-gray-900 transition-colors">
                                    <Home className="h-5 w-5" />
                                </button>
                                <span className="text-lg font-medium text-gray-300">/</span>
                                <h2 className="text-lg font-medium tracking-tight text-gray-900 truncate max-w-md">
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

            {/* Filters / Search Bar & Actions */}
            <div className="mb-3 flex flex-col sm:flex-row items-center gap-3 rounded-2xl border border-gray-100/50 bg-white p-2.5 shadow-sm">
                <div className="relative flex-1 w-full">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                        <Search className="h-4 w-4 text-gray-400" />
                    </div>
                    <Input
                        type="text"
                        placeholder={`Search in ${decodedPath ? decodedPath.split('/').pop() : 'My Files'}...`}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="h-11 w-full rounded-xl border-none bg-gray-50/50 pl-11 font-semibold text-gray-900 placeholder:text-gray-400 focus-visible:ring-1 focus-visible:ring-gray-200"
                    />
                </div>
                <div className="flex w-full items-center gap-2 sm:w-auto sm:shrink-0 justify-end">
                    <Button variant="outline" className="h-11 rounded-xl border-gray-200 font-bold tracking-wide text-gray-700 shadow-sm transition-all hover:bg-gray-50 hover:text-gray-900">
                        <FolderPlus className="mr-2 h-4 w-4" />
                        New Folder
                    </Button>
                    <Button className="h-11 rounded-xl bg-[#0f172a] font-bold tracking-wide text-white shadow-sm transition-all duration-300 hover:bg-[#1e293b]">
                        <Upload className="mr-2 h-4 w-4" />
                        Upload
                    </Button>
                    <div className="h-8 w-[1px] bg-gray-200 mx-1 hidden sm:block"></div>
                    <Button variant="outline" size="icon" className="h-11 w-11 shrink-0 rounded-xl border-gray-100 text-gray-500 hover:bg-gray-50 hover:text-gray-900">
                        <Filter className="h-5 w-5" />
                    </Button>
                </div>
            </div>

            {/* Table Container */}
            <div className="flex flex-col rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden h-[calc(100vh-280px)] min-h-[400px]">
                
                {/* Table Header */}
                <div className="flex items-center border-b border-gray-100 bg-gray-50/50 pl-6 pr-6 py-3 text-[11px] font-extrabold tracking-wider text-gray-400">
                    <div className="flex-1 pr-4">NAME</div>
                    <div className="w-32 shrink-0 pr-4">SIZE</div>
                    <div className="w-32 shrink-0 pr-4">TYPE</div>
                    <div className="w-32 shrink-0 pr-4">MODIFIED</div>
                    <div className="w-24 shrink-0 text-right">ACTIONS</div>
                    <div className="w-3.5 shrink-0" /> {/* Scrollbar spacer */}
                </div>

                {/* Virtualized List Body */}
                <div 
                    ref={parentRef}
                    className="flex-1 overflow-y-scroll overflow-x-hidden custom-scrollbar"
                >
                    {filteredFiles.length === 0 ? (
                        <div className="flex h-full flex-col items-center justify-center text-center">
                            <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-gray-100 bg-white shadow-sm">
                                <Search className="h-7 w-7 text-gray-300" />
                            </div>
                            <h3 className="text-lg font-extrabold tracking-tight text-gray-900">
                                {searchQuery ? 'No matching files found' : 'This folder is empty'}
                            </h3>
                            <p className="mt-1 text-sm font-medium text-gray-500">
                                {searchQuery ? 'Try adjusting your search query.' : 'Upload some files or create a new folder to get started.'}
                            </p>
                        </div>
                    ) : (
                        <div
                            style={{
                                height: `${rowVirtualizer.getTotalSize()}px`,
                                width: '100%',
                                position: 'relative',
                            }}
                        >
                            {rowVirtualizer.getVirtualItems().map((virtualItem) => {
                                const file = filteredFiles[virtualItem.index];
                                return (
                                    <FileTableRow 
                                        key={file.id} 
                                        item={file} 
                                        onNavigate={handleNavigate}
                                        style={{
                                            position: 'absolute',
                                            top: 0,
                                            left: 0,
                                            width: '100%',
                                            height: `${virtualItem.size}px`,
                                            transform: `translateY(${virtualItem.start}px)`,
                                        }}
                                    />
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
            
            {/* CSS for custom scrollbar */}
            <style dangerouslySetInnerHTML={{__html: `
                .custom-scrollbar::-webkit-scrollbar {
                    width: 14px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background-color: #cbd5e1;
                    border-radius: 20px;
                    border: 4px solid transparent;
                    background-clip: content-box;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background-color: #94a3b8;
                }
            `}} />
        </AuthenticatedLayout>
    );
}
