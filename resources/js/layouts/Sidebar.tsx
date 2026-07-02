import { Link, usePage } from '@inertiajs/react';
import {
    LayoutDashboard,
    Cloud,
    LogOut,
    FolderPlus,
    Upload,
    ListTodo,
    Link as LinkIcon,
    Download,
    History,
} from 'lucide-react';
import { useState } from 'react';
import { destroy } from '@/actions/App/Http/Controllers/Auth/LoginController';
import ConnectionNavItem from '@/components/cloud/ConnectionNavItem';
import DeleteConnectionDialog from '@/components/cloud/DeleteConnectionDialog';
import EditConnectionNameDialog from '@/components/cloud/EditConnectionNameDialog';
import EditFtpConnectionDialog from '@/components/cloud/EditFtpConnectionDialog';
import EditS3ConnectionDialog from '@/components/cloud/EditS3ConnectionDialog';
import EditSftpConnectionDialog from '@/components/cloud/EditSftpConnectionDialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatBytes } from '@/lib/format-bytes';
import { index as storageIndex } from '@/routes/storage';
import type { PageProps } from '@/types';
import type { CloudConnection } from '@/types/cloud';

interface SidebarProps {
    readonly cloudActions?: {
        readonly canCreateFolder?: boolean;
        readonly canUpload?: boolean;
        readonly onCreateFolder?: () => void;
        readonly onUpload?: () => void;
        readonly onRemoteUpload?: () => void;
    };
}

function SidebarModals({
    connectionBeingRenamed,
    setConnectionBeingRenamed,
    connectionBeingEdited,
    setConnectionBeingEdited,
    connectionBeingDeleted,
    setConnectionBeingDeleted,
}: Readonly<{
    connectionBeingRenamed: CloudConnection | null;
    setConnectionBeingRenamed: (c: CloudConnection | null) => void;
    connectionBeingEdited: CloudConnection | null;
    setConnectionBeingEdited: (c: CloudConnection | null) => void;
    connectionBeingDeleted: CloudConnection | null;
    setConnectionBeingDeleted: (c: CloudConnection | null) => void;
}>) {
    return (
        <>
            <EditConnectionNameDialog
                connection={connectionBeingRenamed}
                onClose={() => setConnectionBeingRenamed(null)}
            />
            <EditFtpConnectionDialog
                connection={
                    connectionBeingEdited?.provider_value === 5
                        ? connectionBeingEdited
                        : null
                }
                onClose={() => setConnectionBeingEdited(null)}
            />
            <EditS3ConnectionDialog
                connection={
                    connectionBeingEdited?.provider_value === 4
                        ? connectionBeingEdited
                        : null
                }
                onClose={() => setConnectionBeingEdited(null)}
            />
            <EditSftpConnectionDialog
                connection={
                    connectionBeingEdited?.provider_value === 6
                        ? connectionBeingEdited
                        : null
                }
                onClose={() => setConnectionBeingEdited(null)}
            />
            <DeleteConnectionDialog
                connection={connectionBeingDeleted}
                onClose={() => setConnectionBeingDeleted(null)}
            />
        </>
    );
}

export function Sidebar({ cloudActions }: Readonly<SidebarProps>) {
    const { url, props } = usePage<PageProps>();
    const auth = props.auth;
    const user = auth?.user;
    const connections = user?.connections || [];
    const pageConnection = props.connection;
    const activeConnection = pageConnection?.storageQuota
        ? pageConnection
        : connections.find((connection: CloudConnection) =>
              url.startsWith(storageIndex.url({ connection: connection.id })),
          );

    const [connectionBeingRenamed, setConnectionBeingRenamed] =
        useState<CloudConnection | null>(null);
    const [connectionBeingEdited, setConnectionBeingEdited] =
        useState<CloudConnection | null>(null);
    const [connectionBeingDeleted, setConnectionBeingDeleted] =
        useState<CloudConnection | null>(null);

    return (
        <aside className="flex h-full w-65 shrink-0 flex-col border-r border-border bg-card">
            {/* Logo and Brand */}
            <div className="flex h-18 items-center px-6">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md">
                        <Cloud className="h-6 w-6" strokeWidth={2.5} />
                    </div>
                    <div>
                        <div className="text-base font-bold tracking-tight text-foreground">
                            {props.name}
                        </div>
                        <div className="text-[9px] font-bold tracking-wider text-muted-foreground">
                            THE DIGITAL CURATOR
                        </div>
                    </div>
                </div>
            </div>

            {/* Sidebar Navigation */}
            <ScrollArea className="min-h-0 flex-1">
                <div className="space-y-6 px-4 py-4">
                    {/* Main Menu */}
                    <div>
                        <ul className="space-y-1">
                            <li>
                                <Link
                                    prefetch
                                    href="/dashboard"
                                    className={`relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors ${url === '/dashboard' || url === '/' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
                                >
                                    {(url === '/dashboard' || url === '/') && (
                                        <div className="absolute top-1/2 left-0 h-8 w-1 -translate-y-1/2 rounded-r-md bg-primary" />
                                    )}
                                    <LayoutDashboard
                                        className={`h-5 w-5 ${url === '/dashboard' || url === '/' ? 'text-primary' : 'text-muted-foreground'}`}
                                    />
                                    DASHBOARD
                                </Link>
                            </li>
                        </ul>
                    </div>

                    {/* Connected Storage */}
                    <div>
                        <div className="mb-2 px-3 text-[10px] font-bold tracking-wider text-muted-foreground">
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
                                                onEditConnection={
                                                    setConnectionBeingEdited
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
                            <div className="px-3 py-1.5 text-[11px] font-medium text-muted-foreground italic">
                                No storage connected
                            </div>
                        )}
                    </div>

                    {activeConnection &&
                        (cloudActions?.canCreateFolder ||
                            cloudActions?.canUpload) && (
                            <div>
                                <div className="mb-2 px-3 text-[10px] font-bold tracking-wider text-muted-foreground">
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
                                            className="h-10 w-full justify-center rounded-xl text-xs font-bold tracking-wide text-foreground"
                                        >
                                            <FolderPlus className="h-4 w-4" />
                                            New Folder
                                        </Button>
                                    )}
                                    {cloudActions?.canUpload && (
                                        <>
                                            <Button
                                                type="button"
                                                onClick={cloudActions.onUpload}
                                                className="h-10 w-full justify-center rounded-xl bg-primary text-xs font-bold tracking-wide text-primary-foreground shadow-sm hover:bg-primary/90"
                                            >
                                                <Upload className="h-4 w-4" />
                                                Upload
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                onClick={
                                                    cloudActions.onRemoteUpload
                                                }
                                                className="h-10 w-full justify-center rounded-xl text-xs font-bold tracking-wide text-foreground"
                                            >
                                                <Download className="h-4 w-4" />
                                                Remote upload
                                            </Button>
                                        </>
                                    )}
                                </div>
                            </div>
                        )}

                    {/* System Section */}
                    <div>
                        <div className="mb-2 px-3 text-[10px] font-bold tracking-wider text-muted-foreground">
                            SYSTEM
                        </div>
                        <ul className="space-y-1">
                            <li>
                                <Link
                                    prefetch
                                    href="/system/cloud-tasks"
                                    className={`relative flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-bold tracking-wide transition-colors ${url.startsWith('/system/cloud-tasks') ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
                                >
                                    {url.startsWith('/system/cloud-tasks') && (
                                        <div className="absolute top-1/2 left-0 h-7 w-1 -translate-y-1/2 rounded-r-md bg-primary" />
                                    )}
                                    <ListTodo
                                        className={`h-4.5 w-4.5 ${url.startsWith('/system/cloud-tasks') ? 'text-primary' : 'text-muted-foreground'}`}
                                    />
                                    TASKS
                                </Link>
                            </li>
                            <li>
                                <Link
                                    prefetch
                                    href="/system/activity-logs"
                                    className={`relative flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-bold tracking-wide transition-colors ${url.startsWith('/system/activity-logs') ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
                                >
                                    {url.startsWith(
                                        '/system/activity-logs',
                                    ) && (
                                        <div className="absolute top-1/2 left-0 h-7 w-1 -translate-y-1/2 rounded-r-md bg-primary" />
                                    )}
                                    <History
                                        className={`h-4.5 w-4.5 ${url.startsWith('/system/activity-logs') ? 'text-primary' : 'text-muted-foreground'}`}
                                    />
                                    ACTIVITY LOG
                                </Link>
                            </li>
                            <li>
                                <Link
                                    prefetch
                                    href="/system/shared-links"
                                    className={`relative flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-bold tracking-wide transition-colors ${url.startsWith('/system/shared-links') ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
                                >
                                    {url.startsWith('/system/shared-links') && (
                                        <div className="absolute top-1/2 left-0 h-7 w-1 -translate-y-1/2 rounded-r-md bg-primary" />
                                    )}
                                    <LinkIcon
                                        className={`h-4.5 w-4.5 ${url.startsWith('/system/shared-links') ? 'text-primary' : 'text-muted-foreground'}`}
                                    />
                                    SHARED LINKS
                                </Link>
                            </li>
                            <li>
                                <Link
                                    prefetch
                                    href="/video-downloader"
                                    className={`relative flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-bold tracking-wide transition-colors ${url.startsWith('/video-downloader') ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
                                >
                                    {url.startsWith('/video-downloader') && (
                                        <div className="absolute top-1/2 left-0 h-7 w-1 -translate-y-1/2 rounded-r-md bg-primary" />
                                    )}
                                    <Download
                                        className={`h-4.5 w-4.5 ${url.startsWith('/video-downloader') ? 'text-primary' : 'text-muted-foreground'}`}
                                    />
                                    VIDEO DOWNLOADER
                                </Link>
                            </li>
                        </ul>
                    </div>
                </div>
            </ScrollArea>

            {/* Sidebar Footer */}
            <div className="space-y-1 border-t border-border p-4">
                {activeConnection?.storageQuota?.supported && (
                    <div className="rounded-2xl border border-border bg-muted/50 p-4">
                        <div className="mb-2 flex items-center justify-between gap-2">
                            <span className="text-[10px] font-black tracking-widest text-muted-foreground">
                                STORAGE
                            </span>
                            <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-extrabold text-primary">
                                {activeConnection.storageQuota.usedPercent ?? 0}
                                %
                            </span>
                        </div>
                        <div className="mt-3">
                            <Progress
                                value={
                                    activeConnection.storageQuota.usedPercent ??
                                    0
                                }
                                className="h-2 bg-muted [&>div]:bg-primary"
                            />
                        </div>
                        <div className="mt-2 flex items-center justify-between text-[10px] font-bold text-muted-foreground">
                            <span>
                                {formatBytes(
                                    activeConnection.storageQuota.usedBytes ||
                                        0,
                                )}{' '}
                                used
                            </span>
                            <span>
                                {formatBytes(
                                    activeConnection.storageQuota.totalBytes ||
                                        0,
                                )}
                            </span>
                        </div>
                    </div>
                )}
                <Link
                    href={destroy.url()}
                    method="post"
                    as="button"
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-xs font-bold tracking-wide text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                    <LogOut className="h-4.5 w-4.5 text-muted-foreground" />
                    LOGOUT
                </Link>
            </div>

            <SidebarModals
                connectionBeingRenamed={connectionBeingRenamed}
                setConnectionBeingRenamed={setConnectionBeingRenamed}
                connectionBeingEdited={connectionBeingEdited}
                setConnectionBeingEdited={setConnectionBeingEdited}
                connectionBeingDeleted={connectionBeingDeleted}
                setConnectionBeingDeleted={setConnectionBeingDeleted}
            />
        </aside>
    );
}
