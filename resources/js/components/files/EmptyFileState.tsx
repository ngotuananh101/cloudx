import { Search } from 'lucide-react';

interface EmptyFileStateProps {
    searchQuery: string;
}

export function EmptyFileState({ searchQuery }: EmptyFileStateProps) {
    return (
        <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-gray-100 bg-white shadow-sm">
                <Search className="h-7 w-7 text-gray-300" />
            </div>
            <h3 className="text-lg font-extrabold tracking-tight text-gray-900">
                {searchQuery
                    ? 'No matching files found'
                    : 'This folder is empty'}
            </h3>
            <p className="mt-1 text-sm font-medium text-gray-500">
                {searchQuery
                    ? 'Try adjusting your search query.'
                    : 'Upload some files or create a new folder to get started.'}
            </p>
        </div>
    );
}
