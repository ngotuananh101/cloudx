import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    Trash2,
    Copy,
    Globe,
    Lock,
    HardDrive,
    Check,
    Link as LinkIcon,
    Loader2,
    Filter,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import AuthenticatedLayout from '@/layouts/AuthenticatedLayout';
import { index as sharedLinksIndex } from '@/routes/system/shared-links';

interface CloudConnection {
    id: number;
    name: string;
    provider: string;
    provider_icon?: string;
}

interface CloudShare {
    id: number;
    uuid: string;
    path: string;
    name: string;
    is_directory: boolean;
    type: 'public' | 'password';
    expires_at: string | null;
    created_at: string;
    cloud_connection: CloudConnection;
}

interface PaginatedData<T> {
    data: T[];
    links: {
        url: string | null;
        label: string;
        active: boolean;
    }[];
    total: number;
    current_page: number;
    last_page: number;
}

interface SharedLinksPageProps {
    shares: PaginatedData<CloudShare>;
    filters?: {
        connection?: string;
        access_type?: string;
        expires?: string;
        name?: string;
        url?: string;
        created_date?: string;
    };
}

export default function SharedLinksPage({
    shares,
    filters: initialFilters = {},
}: SharedLinksPageProps) {
    const { props } = usePage() as any;
    const userConnections = props.auth?.user?.connections || [];

    const [filters, setFilters] = useState({
        connection: initialFilters.connection || 'all',
        access_type: initialFilters.access_type || 'all',
        expires: initialFilters.expires || 'all',
        name: initialFilters.name || '',
        url: initialFilters.url || '',
        created_date: initialFilters.created_date || '',
    });

    const [copiedId, setCopiedId] = useState<number | null>(null);
    const [shareToDelete, setShareToDelete] = useState<CloudShare | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const applyFilters = () => {
        router.get(sharedLinksIndex.url(), filters as any, {
            preserveState: true,
            preserveScroll: true,
        });
    };

    const clearFilters = () => {
        const defaultFilters = {
            connection: 'all',
            access_type: 'all',
            expires: 'all',
            name: '',
            url: '',
            created_date: '',
        };
        setFilters(defaultFilters);
        router.get(sharedLinksIndex.url(), defaultFilters as any, {
            preserveState: true,
            preserveScroll: true,
        });
    };

    const handleCopy = (id: number, uuid: string) => {
        const url = `${window.location.origin}/s/${uuid}`;

        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard
                .writeText(url)
                .then(() => {
                    setCopiedId(id);
                    toast.success('Link copied to clipboard');
                    setTimeout(() => setCopiedId(null), 2000);
                })
                .catch(() => toast.error('Failed to copy link'));
        } else {
            const textArea = document.createElement('textarea');
            textArea.value = url;
            textArea.style.position = 'fixed';
            textArea.style.opacity = '0';
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();

            try {
                if (document.execCommand('copy')) {
                    setCopiedId(id);
                    toast.success('Link copied to clipboard');
                    setTimeout(() => setCopiedId(null), 2000);
                } else {
                    toast.error('Failed to copy link');
                }
            } catch {
                toast.error('Failed to copy link');
            } finally {
                document.body.removeChild(textArea);
            }
        }
    };

    const confirmDeleteShare = () => {
        if (!shareToDelete) {
            return;
        }

        setIsDeleting(true);
        router.delete(`/system/shared-links/${shareToDelete.id}`, {
            preserveScroll: true,
            onSuccess: () => {
                setShareToDelete(null);
                toast.success('Shared link deleted successfully');
            },
            onFinish: () => setIsDeleting(false),
        });
    };

    return (
        <AuthenticatedLayout>
            <Head title="Shared Links" />

            <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                    <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
                        Shared Links
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Manage all the links you have shared across your cloud
                        connections.
                    </p>
                </div>
            </div>

            <Card className="mb-6 gap-0 rounded-2xl border border-border bg-card shadow-sm">
                <CardHeader className="border-b border-border pb-4">
                    <CardTitle className="flex items-center gap-2 text-[10px] font-extrabold tracking-widest text-muted-foreground uppercase">
                        <Filter className="h-4 w-4 text-muted-foreground" />
                        Filter Links
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-4 pb-0">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                        <div className="space-y-1.5">
                            <label
                                htmlFor="filter-connection"
                                className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase"
                            >
                                Connection
                            </label>
                            <Select
                                value={filters.connection}
                                onValueChange={(v) =>
                                    setFilters({ ...filters, connection: v })
                                }
                            >
                                <SelectTrigger
                                    id="filter-connection"
                                    className="h-9 w-full"
                                >
                                    <SelectValue placeholder="All Connections" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">
                                        All Connections
                                    </SelectItem>
                                    {userConnections.map(
                                        (c: CloudConnection) => (
                                            <SelectItem
                                                key={c.id}
                                                value={c.id.toString()}
                                            >
                                                {c.name}
                                            </SelectItem>
                                        ),
                                    )}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <label
                                htmlFor="filter-access"
                                className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase"
                            >
                                Access Type
                            </label>
                            <Select
                                value={filters.access_type}
                                onValueChange={(v) =>
                                    setFilters({ ...filters, access_type: v })
                                }
                            >
                                <SelectTrigger
                                    id="filter-access"
                                    className="h-9 w-full"
                                >
                                    <SelectValue placeholder="All Types" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">
                                        All Types
                                    </SelectItem>
                                    <SelectItem value="public">
                                        Public
                                    </SelectItem>
                                    <SelectItem value="password">
                                        Password Protected
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <label
                                htmlFor="filter-expires"
                                className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase"
                            >
                                Expires
                            </label>
                            <Select
                                value={filters.expires}
                                onValueChange={(v) =>
                                    setFilters({ ...filters, expires: v })
                                }
                            >
                                <SelectTrigger
                                    id="filter-expires"
                                    className="h-9 w-full"
                                >
                                    <SelectValue placeholder="Any Time" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">
                                        Any Time
                                    </SelectItem>
                                    <SelectItem value="active">
                                        Active
                                    </SelectItem>
                                    <SelectItem value="expired">
                                        Expired
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <label
                                htmlFor="filter-name"
                                className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase"
                            >
                                File/Folder Name
                            </label>
                            <Input
                                id="filter-name"
                                value={filters.name}
                                onChange={(e) =>
                                    setFilters({
                                        ...filters,
                                        name: e.target.value,
                                    })
                                }
                                placeholder="Search name..."
                                className="h-9"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label
                                htmlFor="filter-url"
                                className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase"
                            >
                                URL
                            </label>
                            <Input
                                id="filter-url"
                                value={filters.url}
                                onChange={(e) =>
                                    setFilters({
                                        ...filters,
                                        url: e.target.value,
                                    })
                                }
                                placeholder="Search URL..."
                                className="h-9"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label
                                htmlFor="filter-created"
                                className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase"
                            >
                                Created Date
                            </label>
                            <Input
                                id="filter-created"
                                value={filters.created_date}
                                onChange={(e) =>
                                    setFilters({
                                        ...filters,
                                        created_date: e.target.value,
                                    })
                                }
                                type="date"
                                className="h-9"
                            />
                        </div>
                    </div>
                    <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                        <Button
                            onClick={clearFilters}
                            variant="ghost"
                            size="sm"
                            className="h-9 text-muted-foreground hover:text-foreground"
                        >
                            Clear Filters
                        </Button>
                        <Button
                            onClick={applyFilters}
                            size="sm"
                            className="h-9 bg-primary text-primary-foreground hover:bg-primary/90"
                        >
                            Apply Filters
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <Card className="overflow-hidden rounded-2xl border border-border bg-card pt-0 shadow-sm">
                <CardContent className="p-0">
                    {shares.data.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                            <div className="mb-4 rounded-full bg-muted p-4">
                                <LinkIcon className="h-8 w-8 text-muted-foreground" />
                            </div>
                            <h3 className="text-lg font-extrabold text-foreground">
                                No shared links
                            </h3>
                            <p className="mt-2 text-sm text-muted-foreground">
                                You haven't shared any files or folders yet.
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-215 text-left text-sm">
                                <thead>
                                    <tr className="border-b border-border bg-muted/50 text-[11px] font-extrabold tracking-wider text-muted-foreground">
                                        <th className="px-5 py-3">
                                            File/Folder
                                        </th>
                                        <th className="px-5 py-3">
                                            Connection
                                        </th>
                                        <th className="px-5 py-3">
                                            Access Type
                                        </th>
                                        <th className="px-5 py-3">URL</th>
                                        <th className="px-5 py-3">Created</th>
                                        <th className="px-5 py-3">Expires</th>
                                        <th className="px-5 py-3 text-right">
                                            Action
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {shares.data.map((share) => {
                                        const fullConnection = (
                                            userConnections || []
                                        ).find(
                                            (c: CloudConnection) =>
                                                c.id ===
                                                share.cloud_connection.id,
                                        );

                                        return (
                                            <tr
                                                key={share.id}
                                                className="border-b border-border last:border-b-0 hover:bg-muted/70"
                                            >
                                                <td className="max-w-60 px-5 py-4">
                                                    <div className="truncate text-sm font-medium text-foreground">
                                                        {share.name}
                                                    </div>
                                                </td>
                                                <td className="max-w-56 px-5 py-4">
                                                    <div className="flex items-center gap-2">
                                                        {fullConnection?.provider_icon?.endsWith(
                                                            '.svg',
                                                        ) ? (
                                                            <img
                                                                src={
                                                                    fullConnection.provider_icon
                                                                }
                                                                className="h-4 w-4 shrink-0"
                                                                alt={
                                                                    fullConnection.provider
                                                                }
                                                            />
                                                        ) : (
                                                            <HardDrive className="h-4 w-4 shrink-0 text-muted-foreground" />
                                                        )}
                                                        <div className="truncate text-xs font-medium text-muted-foreground">
                                                            {
                                                                share
                                                                    .cloud_connection
                                                                    .name
                                                            }
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-5 py-4">
                                                    <div className="flex items-center gap-1.5">
                                                        {share.type ===
                                                        'public' ? (
                                                            <Globe className="h-3.5 w-3.5 text-primary" />
                                                        ) : (
                                                            <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                                                        )}
                                                        <span
                                                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase ${share.type === 'public' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}
                                                        >
                                                            {share.type}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="max-w-60 px-5 py-4">
                                                    <div className="truncate text-xs text-muted-foreground">
                                                        {window.location.origin}
                                                        /s/{share.uuid}
                                                    </div>
                                                </td>
                                                <td className="px-5 py-4 text-xs font-medium text-muted-foreground">
                                                    {new Date(
                                                        share.created_at,
                                                    ).toLocaleDateString()}
                                                </td>
                                                <td className="px-5 py-4 text-xs font-medium text-muted-foreground">
                                                    {share.expires_at
                                                        ? new Date(
                                                              share.expires_at,
                                                          ).toLocaleDateString()
                                                        : 'Never'}
                                                </td>
                                                <td className="px-5 py-4 text-right">
                                                    <div className="flex shrink-0 items-center justify-end gap-1">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-muted-foreground hover:text-primary"
                                                            onClick={() =>
                                                                handleCopy(
                                                                    share.id,
                                                                    share.uuid,
                                                                )
                                                            }
                                                            title="Copy Link"
                                                        >
                                                            {copiedId ===
                                                            share.id ? (
                                                                <Check className="h-4 w-4 text-primary" />
                                                            ) : (
                                                                <Copy className="h-4 w-4" />
                                                            )}
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                                            onClick={() =>
                                                                setShareToDelete(
                                                                    share,
                                                                )
                                                            }
                                                            title="Delete Shared Link"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Pagination */}
                    {shares.last_page > 1 && (
                        <div className="flex items-center justify-center gap-1 border-t border-border p-4">
                            {shares.links.map((link, i) => (
                                <Button
                                    key={i}
                                    variant={
                                        link.active ? 'default' : 'outline'
                                    }
                                    size="sm"
                                    className={`h-8 ${link.active ? 'border-transparent bg-primary text-primary-foreground hover:bg-primary/90' : 'text-muted-foreground'}`}
                                    disabled={!link.url}
                                    asChild
                                >
                                    {link.url ? (
                                        <Link
                                            href={link.url}
                                            dangerouslySetInnerHTML={{
                                                __html: link.label,
                                            }}
                                        />
                                    ) : (
                                        <span
                                            dangerouslySetInnerHTML={{
                                                __html: link.label,
                                            }}
                                        />
                                    )}
                                </Button>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            <AlertDialog
                open={!!shareToDelete}
                onOpenChange={(open) => !open && setShareToDelete(null)}
            >
                <AlertDialogContent className="rounded-xl border-border bg-card">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-foreground">
                            Delete Shared Link?
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-muted-foreground">
                            Are you sure you want to delete the shared link for{' '}
                            <strong className="text-foreground">
                                "{shareToDelete?.name}"
                            </strong>
                            ? Anyone with this link will immediately lose
                            access. This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel
                            disabled={isDeleting}
                            className="border-border bg-card text-foreground hover:bg-muted"
                        >
                            Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => {
                                e.preventDefault();
                                confirmDeleteShare();
                            }}
                            className="text-destructive-foreground border-0 bg-destructive hover:bg-destructive/90"
                            disabled={isDeleting}
                        >
                            {isDeleting ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : null}
                            Delete Link
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </AuthenticatedLayout>
    );
}
