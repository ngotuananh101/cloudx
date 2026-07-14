import type { ReactNode } from 'react';
import UploadProgressPanel from '@/components/files/UploadProgressPanel';
import { Navbar } from './Navbar';
import { Sidebar } from './Sidebar';

interface AuthenticatedLayoutProps {
    children: ReactNode;
    title?: string;
    cloudSearch?: {
        value: string;
        onChange: (value: string) => void;
        placeholder: string;
    };
    cloudActions?: {
        canCreateFolder?: boolean;
        canUpload?: boolean;
        onCreateFolder?: () => void;
        onUpload?: () => void;
        onRemoteUpload?: () => void;
        onClearCache?: () => void;
        onSync?: () => void;
    };
}

export default function AuthenticatedLayout({
    children,
    cloudSearch,
    cloudActions,
}: Readonly<AuthenticatedLayoutProps>) {
    return (
        <div className="flex h-screen w-screen overflow-hidden bg-muted font-sans text-foreground antialiased">
            <Sidebar cloudActions={cloudActions} />
            <div className="flex flex-1 flex-col overflow-hidden">
                <Navbar cloudSearch={cloudSearch} cloudActions={cloudActions} />
                <main className="flex-1 overflow-y-auto bg-muted p-6">
                    <div className="mx-auto max-w-full">{children}</div>
                </main>
            </div>
            <UploadProgressPanel />
        </div>
    );
}
