import { Head } from '@inertiajs/react';
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef, useState, useMemo } from 'react';
import { FileTableRow, FileItemProps } from '@/components/FileTableRow';
import { Button } from '@/components/ui/button';
import { Upload, FolderPlus, Search, Filter } from 'lucide-react';
import { Input } from '@/components/ui/input';

// Generate mock data for demonstration
const generateMockData = (count: number): FileItemProps[] => {
    const types: FileItemProps['type'][] = ['folder', 'document', 'image', 'code', 'archive', 'video', 'audio'];
    const extensions: Record<string, string[]> = {
        document: ['.pdf', '.docx', '.txt', '.md'],
        image: ['.png', '.jpg', '.svg', '.gif'],
        code: ['.js', '.tsx', '.py', '.php', '.css', '.html'],
        archive: ['.zip', '.tar.gz', '.rar'],
        video: ['.mp4', '.mov', '.avi'],
        audio: ['.mp3', '.wav']
    };
    
    const folderNames = ['Projects', 'Design Assets', 'Invoices 2024', 'Marketing', 'Development', 'Personal', 'A very long folder name that should definitely be truncated because it is too long to fit in the table column properly and needs an ellipsis'];

    return Array.from({ length: count }, (_, i) => {
        const type = Math.random() > 0.8 ? 'folder' : types[Math.floor(Math.random() * (types.length - 1)) + 1];
        
        let name = '';
        if (type === 'folder') {
            name = folderNames[Math.floor(Math.random() * folderNames.length)] + (i > 10 ? ` ${i}` : '');
        } else {
            const exts = extensions[type] || ['.file'];
            // Occasionally generate a very long file name
            if (i % 15 === 0) {
                name = `This_is_an_extremely_long_file_name_that_simulates_a_user_uploading_a_file_with_a_crazy_long_name_like_a_zoom_recording_or_something_similar_from_2024_Q1_FINAL_v2_copy_123456789${exts[Math.floor(Math.random() * exts.length)]}`;
            } else {
                name = `File_${i.toString().padStart(4, '0')}${exts[Math.floor(Math.random() * exts.length)]}`;
            }
        }

        return {
            id: i,
            name,
            type,
            size: type === 'folder' ? 0 : Math.floor(Math.random() * 1024 * 1024 * 50) + 1024,
            updatedAt: new Date(Date.now() - Math.random() * 10000000000).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
            })
        };
    });
};

export default function FileBrowser() {
    const [searchQuery, setSearchQuery] = useState('');
    const allFiles = useMemo(() => generateMockData(10000), []);

    const filteredFiles = useMemo(() => {
        if (!searchQuery) return allFiles;
        return allFiles.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()));
    }, [allFiles, searchQuery]);

    const parentRef = useRef<HTMLDivElement>(null);

    const rowVirtualizer = useVirtualizer({
        count: filteredFiles.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 56, // Fixed height for table rows
        overscan: 15,
    });

    return (
        <AuthenticatedLayout title="Files">
            <Head title="Files & Folders" />

            {/* Header & Controls */}
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <span className="text-[10px] font-extrabold tracking-widest text-gray-400">
                        WORKSPACE
                    </span>
                    <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-gray-900">
                        Files & Folders
                    </h2>
                </div>
                <div className="flex items-center gap-3 self-start sm:self-center">
                    <Button variant="outline" className="h-10 rounded-xl border-gray-200 font-bold tracking-wide text-gray-700 shadow-sm transition-all hover:bg-gray-50 hover:text-gray-900">
                        <FolderPlus className="mr-2 h-4 w-4" />
                        New Folder
                    </Button>
                    <Button className="h-10 rounded-xl bg-[#0f172a] font-bold tracking-wide text-white shadow-sm transition-all duration-300 hover:bg-[#1e293b]">
                        <Upload className="mr-2 h-4 w-4" />
                        Upload
                    </Button>
                </div>
            </div>

            {/* Filters / Search Bar */}
            <div className="mb-6 flex items-center gap-4 rounded-2xl border border-gray-100/50 bg-white p-2.5 shadow-sm">
                <div className="relative flex-1">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                        <Search className="h-4 w-4 text-gray-400" />
                    </div>
                    <Input
                        type="text"
                        placeholder="Search across 10,000+ files..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="h-11 w-full rounded-xl border-none bg-gray-50/50 pl-11 font-semibold text-gray-900 placeholder:text-gray-400 focus-visible:ring-1 focus-visible:ring-gray-200"
                    />
                </div>
                <Button variant="outline" size="icon" className="h-11 w-11 shrink-0 rounded-xl border-gray-100 text-gray-500 hover:bg-gray-50 hover:text-gray-900">
                    <Filter className="h-5 w-5" />
                </Button>
            </div>

            {/* Table Container */}
            <div className="flex flex-col rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden h-[calc(100vh-280px)] min-h-[400px]">
                
                {/* Table Header */}
                <div className="flex items-center border-b border-gray-100 bg-gray-50/50 pl-6 pr-[38px] py-3 text-[11px] font-extrabold tracking-wider text-gray-400">
                    <div className="flex-1 pr-4">NAME</div>
                    <div className="w-32 shrink-0 pr-4">SIZE</div>
                    <div className="w-32 shrink-0 pr-4">TYPE</div>
                    <div className="w-32 shrink-0 pr-4">MODIFIED</div>
                    <div className="w-24 shrink-0 text-right">ACTIONS</div>
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
                            <h3 className="text-lg font-extrabold tracking-tight text-gray-900">No files found</h3>
                            <p className="mt-1 text-sm font-medium text-gray-500">We couldn't find anything matching your search.</p>
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
