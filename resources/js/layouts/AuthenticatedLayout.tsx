import { Link, usePage } from '@inertiajs/react';
import {
    LayoutDashboard,
    Cloud,
    Settings,
    HelpCircle,
    LogOut,
    Bell,
    FolderPlus,
    Search,
    Settings2,
    Upload,
} from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { destroy } from '@/actions/App/Http/Controllers/Auth/LoginController';
import ConnectionNavItem from '@/components/cloud/ConnectionNavItem';
import DeleteConnectionDialog from '@/components/cloud/DeleteConnectionDialog';
import EditConnectionNameDialog from '@/components/cloud/EditConnectionNameDialog';
import UploadProgressPanel from '@/components/files/UploadProgressPanel';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { formatBytes } from '@/lib/format-bytes';
import { index as storageIndex } from '@/routes/storage';
import type { CloudConnection } from '@/types/cloud';

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
    };
}

export default function AuthenticatedLayout({
    children,
    cloudSearch,
    cloudActions,
}: AuthenticatedLayoutProps) {
    const { url, props } = usePage() as any;
    const auth = props.auth;
    const user = auth?.user;
    const connections = user?.connections || [];
    const pageConnection = props.connection as any;
    const activeConnection = pageConnection?.storageQuota
        ? pageConnection
        : connections.find((connection: CloudConnection) =>
              url.startsWith(storageIndex.url({ connection: connection.id })),
          );
    const [connectionBeingRenamed, setConnectionBeingRenamed] =
        useState<CloudConnection | null>(null);
    const [connectionBeingDeleted, setConnectionBeingDeleted] =
        useState<CloudConnection | null>(null);

    return (
        <div className="flex h-screen w-screen overflow-hidden bg-[#f4f5f7] font-sans text-gray-900 antialiased">
            {/* Sidebar */}
            <aside className="flex h-full w-[260px] shrink-0 flex-col border-r border-gray-200 bg-white">
                {/* Logo and Brand */}
                <div className="flex h-[72px] items-center px-6">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand text-white shadow-md">
                            <Cloud className="h-6 w-6" strokeWidth={2.5} />
                        </div>
                        <div>
                            <div className="text-base font-bold tracking-tight text-gray-900">
                                CloudHub
                            </div>
                            <div className="text-[9px] font-bold tracking-wider text-gray-400">
                                THE DIGITAL CURATOR
                            </div>
                        </div>
                    </div>
                </div>

                {/* Sidebar Navigation */}
                <div className="flex-1 space-y-6 overflow-y-auto px-4 py-4">
                    {/* Main Menu */}
                    <div>
                        <ul className="space-y-1">
                            <li>
                                <Link
                                    href="/dashboard"
                                    className={`relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors ${url === '/dashboard' || url === '/' ? 'bg-red-50/50 text-brand' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'}`}
                                >
                                    {(url === '/dashboard' || url === '/') && (
                                        <div className="absolute top-1/2 left-0 h-8 w-1 -translate-y-1/2 rounded-r-md bg-brand" />
                                    )}
                                    <LayoutDashboard
                                        className={`h-5 w-5 ${url === '/dashboard' || url === '/' ? 'text-brand' : 'text-gray-400'}`}
                                    />
                                    DASHBOARD
                                </Link>
                            </li>
                        </ul>
                    </div>

                    {/* Connected Storage */}
                    <div>
                        <div className="mb-2 px-3 text-[10px] font-bold tracking-wider text-gray-400">
                            CONNECTED STORAGE
                        </div>
                        {connections && connections.length > 0 ? (
                            <ul className="space-y-1">
                                {connections.map(
                                    (connection: CloudConnection) => {
                                        const storageUrl = storageIndex.url({
                                            connection: connection.id,
                                        });
                                        const isActive =
                                            url.startsWith(storageUrl);

                                        return (
                                            <ConnectionNavItem
                                                key={connection.id}
                                                connection={connection}
                                                href={storageUrl}
                                                isActive={isActive}
                                                onEditName={
                                                    setConnectionBeingRenamed
                                                }
                                                onDelete={
                                                    setConnectionBeingDeleted
                                                }
                                            />
                                        );
                                    },
                                )}
                            </ul>
                        ) : (
                            <div className="px-3 py-1.5 text-[11px] font-medium text-gray-400 italic">
                                No storage connected
                            </div>
                        )}
                    </div>

                    {activeConnection &&
                        (cloudActions?.canCreateFolder ||
                            cloudActions?.canUpload) && (
                            <div>
                                <div className="mb-2 px-3 text-[10px] font-bold tracking-wider text-gray-400">
                                    CLOUD ACTIONS
                                </div>
                                <div className="space-y-2 px-3">
                                    {cloudActions?.canCreateFolder && (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={
                                                cloudActions.onCreateFolder
                                            }
                                            className="h-10 w-full justify-center rounded-xl border-gray-200 text-xs font-bold tracking-wide text-gray-700"
                                        >
                                            <FolderPlus className="h-4 w-4" />
                                            New Folder
                                        </Button>
                                    )}
                                    {cloudActions?.canUpload && (
                                        <Button
                                            type="button"
                                            onClick={cloudActions.onUpload}
                                            className="h-10 w-full justify-center rounded-xl bg-brand text-xs font-bold tracking-wide text-white shadow-sm hover:bg-[#a0181e]"
                                        >
                                            <Upload className="h-4 w-4" />
                                            Upload
                                        </Button>
                                    )}
                                </div>
                            </div>
                        )}

                    {/* System Section */}
                    <div>
                        <div className="mb-2 px-3 text-[10px] font-bold tracking-wider text-gray-400">
                            SYSTEM
                        </div>
                        <ul className="space-y-1">
                            <li>
                                <a
                                    href="#"
                                    className="flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-bold tracking-wide text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-900"
                                >
                                    <Settings2 className="h-4.5 w-4.5 text-gray-400" />
                                    SETTINGS
                                </a>
                            </li>
                        </ul>
                    </div>
                </div>

                {/* Sidebar Footer */}
                <div className="space-y-1 border-t border-gray-100 p-4">
                    {activeConnection?.storageQuota?.supported && (
                        <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                            <div className="mb-2 flex items-center justify-between gap-2">
                                <span className="text-[10px] font-black tracking-widest text-gray-400">
                                    STORAGE
                                </span>
                                <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-extrabold text-brand">
                                    {activeConnection.storageQuota
                                        .usedPercent ?? 0}
                                    %
                                </span>
                            </div>
                            <div className="mt-3">
                                <Progress
                                    value={
                                        activeConnection.storageQuota
                                            .usedPercent ?? 0
                                    }
                                    className="h-2 bg-gray-200 [&>div]:bg-brand"
                                />
                            </div>
                            <div className="mt-2 flex items-center justify-between text-[10px] font-bold text-gray-500">
                                <span>
                                    {formatBytes(
                                        activeConnection.storageQuota
                                            .usedBytes || 0,
                                    )}{' '}
                                    used
                                </span>
                                <span>
                                    {formatBytes(
                                        activeConnection.storageQuota
                                            .totalBytes || 0,
                                    )}
                                </span>
                            </div>
                        </div>
                    )}
                    <a
                        href="#"
                        className="flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-bold tracking-wide text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-900"
                    >
                        <HelpCircle className="h-4.5 w-4.5 text-gray-400" />
                        HELP
                    </a>
                    <Link
                        href={destroy.url()}
                        method="post"
                        as="button"
                        className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-xs font-bold tracking-wide text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-900"
                    >
                        <LogOut className="h-4.5 w-4.5 text-gray-400" />
                        LOGOUT
                    </Link>
                </div>
            </aside>

            {/* Main Area */}
            <div className="flex flex-1 flex-col overflow-hidden">
                {/* Navbar */}
                <header className="flex h-[72px] w-full flex-shrink-0 items-center justify-between border-b border-gray-200 bg-white px-8">
                    <div className="flex min-w-0 flex-1 items-center gap-6">
                        {cloudSearch && activeConnection && (
                            <div className="relative w-full max-w-md">
                                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                                    <Search className="h-4 w-4 text-gray-400" />
                                </div>
                                <Input
                                    type="text"
                                    placeholder={cloudSearch.placeholder}
                                    value={cloudSearch.value}
                                    onChange={(event) =>
                                        cloudSearch.onChange(event.target.value)
                                    }
                                    className="h-11 w-full rounded-xl border-none bg-gray-50 pl-11 font-semibold text-gray-900 placeholder:text-gray-400 focus-visible:ring-1 focus-visible:ring-gray-200"
                                />
                            </div>
                        )}
                    </div>

                    {/* Right: Actions and User */}
                    <div className="flex items-center gap-4">
                        {/* Notification Bell */}
                        <button className="relative flex h-10 w-10 items-center justify-center rounded-xl transition-colors hover:bg-gray-50">
                            <Bell className="h-5 w-5 text-gray-600" />
                            <span className="absolute top-3 right-3 h-2 w-2 rounded-full bg-brand" />
                        </button>

                        {/* Settings Button */}
                        <button className="flex h-10 w-10 items-center justify-center rounded-xl transition-colors hover:bg-gray-50">
                            <Settings className="h-5 w-5 text-gray-600" />
                        </button>

                        {/* User Avatar */}
                        <Avatar className="h-10 w-10 cursor-pointer border border-gray-200 shadow-sm">
                            <AvatarImage src="" />
                            <AvatarFallback className="bg-red-50 text-sm font-bold text-brand">
                                {user?.name
                                    ? user.name
                                          .split(' ')
                                          .map((n: string) => n[0])
                                          .join('')
                                          .toUpperCase()
                                    : 'U'}
                            </AvatarFallback>
                        </Avatar>
                    </div>
                </header>

                {/* Content scroll wrapper */}
                <main className="flex-1 overflow-y-auto bg-[#f8f9fa] p-6">
                    <div className="mx-auto max-w-7xl">{children}</div>
                </main>
            </div>
            <EditConnectionNameDialog
                connection={connectionBeingRenamed}
                onClose={() => setConnectionBeingRenamed(null)}
            />
            <DeleteConnectionDialog
                connection={connectionBeingDeleted}
                onClose={() => setConnectionBeingDeleted(null)}
            />
            <UploadProgressPanel />
        </div>
    );
}
