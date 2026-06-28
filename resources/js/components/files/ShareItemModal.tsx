import { router } from '@inertiajs/react';
import { Copy, Trash2, Globe, Lock, Loader2, Check } from 'lucide-react';
import { useState, useEffect } from 'react';
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
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import connections from '@/routes/connections';
import type { CloudFile } from '@/types/cloud';

interface CloudShare {
    id: number;
    uuid: string;
    type: 'public' | 'password';
    expires_at: string | null;
    created_at: string;
}

interface ShareItemModalProps {
    isOpen: boolean;
    onClose: () => void;
    item: CloudFile | null;
    connectionId: number;
}

export default function ShareItemModal({
    isOpen,
    onClose,
    item,
    connectionId,
}: ShareItemModalProps) {
    const [shares, setShares] = useState<CloudShare[]>([]);
    const [isLoadingShares, setIsLoadingShares] = useState(false);

    // Form state
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [type, setType] = useState<'public' | 'password'>('public');
    const [password, setPassword] = useState('');
    const [expiresInDays, setExpiresInDays] = useState('0');
    const [error, setError] = useState<string | null>(null);

    // Copy state
    const [copiedId, setCopiedId] = useState<number | null>(null);

    // Delete state
    const [shareToDelete, setShareToDelete] = useState<CloudShare | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        if (!isOpen || !item) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setShares([]);

            setError(null);

            setType('public');

            setPassword('');

            setExpiresInDays('0');

            return;
        }

        fetchShares();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, item, connectionId]);

    async function fetchShares() {
        if (!item) {
            return;
        }

        setIsLoadingShares(true);

        try {
            const url = `${connections.shares.index.url({ connection: connectionId })}?path=${encodeURIComponent(item.path)}`;
            const response = await fetch(url);

            if (!response.ok) {
                throw new Error('Failed to fetch shares');
            }

            const data = await response.json();
            setShares(data);
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoadingShares(false);
        }
    }

    const handleCreateShare = () => {
        if (!item) {
            return;
        }

        setError(null);
        setIsSubmitting(true);

        const data = {
            path: item.path,
            name: item.name,
            is_directory: item.isDirectory,
            type: type,
            password: type === 'password' ? password : null,
            expires_in_days:
                expiresInDays === '0' ? null : parseInt(expiresInDays, 10),
            size: item.isDirectory ? null : item.size,
        };

        router.post(
            connections.shares.store.url({ connection: connectionId }),
            data,
            {
                preserveScroll: true,
                onSuccess: () => {
                    setType('public');
                    setPassword('');
                    setExpiresInDays('0');
                    fetchShares();
                },
                onError: (errors: any) => {
                    const firstError = Object.values(errors)[0] as string;
                    setError(firstError || 'Failed to create share.');
                },
                onFinish: () => setIsSubmitting(false),
            },
        );
    };

    const confirmDeleteShare = () => {
        if (!shareToDelete) {
            return;
        }

        setIsDeleting(true);
        router.delete(
            connections.shares.destroy.url({
                connection: connectionId,
                share: shareToDelete.id,
            }),
            {
                preserveScroll: true,
                onSuccess: () => {
                    setShares(shares.filter((s) => s.id !== shareToDelete.id));
                    setShareToDelete(null);
                },
                onFinish: () => setIsDeleting(false),
            },
        );
    };

    const handleCopy = (id: number, uuid: string) => {
        const url = `${globalThis.location.origin}/s/${uuid}`;

        if (navigator.clipboard && globalThis.isSecureContext) {
            navigator.clipboard
                .writeText(url)
                .then(() => {
                    setCopiedId(id);
                    toast.success('Link copied to clipboard');
                    setTimeout(() => setCopiedId(null), 2000);
                })
                .catch(() => {
                    toast.error('Failed to copy link');
                });
        } else {
            // Fallback for non-secure contexts (e.g., http:// custom local domains)
            const textArea = document.createElement('textarea');
            textArea.value = url;
            textArea.style.position = 'fixed';
            textArea.style.opacity = '0';

            // Append to dialog to prevent Radix focus trap from blocking selection
            const container =
                document.querySelector('[role="dialog"]') || document.body;
            container.appendChild(textArea);

            textArea.focus();
            textArea.select();

            try {
                const successful = document.execCommand('copy');

                if (successful) {
                    setCopiedId(id);
                    toast.success('Link copied to clipboard');
                    setTimeout(() => setCopiedId(null), 2000);
                } else {
                    toast.error('Failed to copy link');
                }
            } catch {
                toast.error('Failed to copy link');
            } finally {
                container.removeChild(textArea);
            }
        }
    };

    return (
        <>
            <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
                <DialogContent className="rounded-3xl border-border bg-card p-6 shadow-2xl sm:max-w-xl">
                    <DialogHeader className="mb-4">
                        <DialogTitle className="text-foreground">
                            Share "{item?.name}"
                        </DialogTitle>
                        <DialogDescription className="text-muted-foreground">
                            Create a link to share this item with others.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="min-w-0 space-y-6">
                        {/* Create Share Form */}
                        <div className="space-y-4 rounded-xl border border-border bg-muted/50 p-4">
                            <div className="space-y-3">
                                <Label className="text-sm font-semibold text-foreground">
                                    Access Type
                                </Label>
                                <RadioGroup
                                    value={type}
                                    onValueChange={(val) =>
                                        setType(val as 'public' | 'password')
                                    }
                                    className="flex flex-col space-y-1"
                                >
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem
                                            value="public"
                                            id="r-public"
                                        />
                                        <Label
                                            htmlFor="r-public"
                                            className="flex cursor-pointer items-center gap-2 font-medium text-foreground"
                                        >
                                            <Globe className="h-4 w-4 text-primary" />
                                            Public (Anyone with link)
                                        </Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem
                                            value="password"
                                            id="r-password"
                                        />
                                        <Label
                                            htmlFor="r-password"
                                            className="flex cursor-pointer items-center gap-2 font-medium text-foreground"
                                        >
                                            <Lock className="h-4 w-4 text-muted-foreground" />
                                            Password Protected
                                        </Label>
                                    </div>
                                </RadioGroup>
                            </div>

                            {type === 'password' && (
                                <div className="space-y-2">
                                    <Label htmlFor="password">Password</Label>
                                    <Input
                                        id="password"
                                        type="password"
                                        value={password}
                                        onChange={(e) =>
                                            setPassword(e.target.value)
                                        }
                                        placeholder="Enter a secure password"
                                        className="h-10 border-0 bg-card"
                                    />
                                </div>
                            )}

                            <div className="space-y-2">
                                <Label>Expiration</Label>
                                <Select
                                    value={expiresInDays}
                                    onValueChange={setExpiresInDays}
                                >
                                    <SelectTrigger className="h-10 border-0 bg-card">
                                        <SelectValue placeholder="Select expiration" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="0">
                                            Never expires
                                        </SelectItem>
                                        <SelectItem value="1">1 Day</SelectItem>
                                        <SelectItem value="7">
                                            7 Days
                                        </SelectItem>
                                        <SelectItem value="30">
                                            30 Days
                                        </SelectItem>
                                        <SelectItem value="90">
                                            90 Days
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {error && (
                                <p className="text-sm font-medium text-destructive">
                                    {error}
                                </p>
                            )}

                            <Button
                                onClick={handleCreateShare}
                                disabled={
                                    isSubmitting ||
                                    (type === 'password' && password.length < 4)
                                }
                                className="w-full bg-primary text-white hover:bg-primary/90"
                            >
                                {isSubmitting ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : null}
                                Create Share Link
                            </Button>
                        </div>

                        {/* Existing Shares List */}
                        {isLoadingShares ? (
                            <div className="flex justify-center p-4">
                                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                            </div>
                        ) : shares.length > 0 ? (
                            <div className="space-y-3">
                                <h4 className="text-sm font-semibold text-foreground">
                                    Active Links
                                </h4>
                                <div className="space-y-2">
                                    {shares.map((share) => (
                                        <div
                                            key={share.id}
                                            className="flex items-center justify-between rounded-lg border border-border bg-card p-3"
                                        >
                                            <div className="flex min-w-0 flex-col pr-2">
                                                <div className="mb-1 flex min-w-0 items-center gap-2">
                                                    {share.type === 'public' ? (
                                                        <Globe className="h-3 w-3 shrink-0 text-primary" />
                                                    ) : (
                                                        <Lock className="h-3 w-3 shrink-0 text-muted-foreground" />
                                                    )}
                                                    <span className="truncate text-sm font-medium text-foreground">
                                                        {
                                                            globalThis.location
                                                                .origin
                                                        }
                                                        /s/{share.uuid}
                                                    </span>
                                                </div>
                                                <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                                                    <span
                                                        className={`font-medium capitalize ${share.type === 'public' ? 'text-primary' : 'text-muted-foreground'}`}
                                                    >
                                                        {share.type}
                                                    </span>
                                                    <span>•</span>
                                                    <span>
                                                        Created{' '}
                                                        {new Date(
                                                            share.created_at,
                                                        ).toLocaleDateString()}
                                                    </span>
                                                    <span>•</span>
                                                    <span>
                                                        {share.expires_at
                                                            ? `Expires ${new Date(share.expires_at).toLocaleDateString()}`
                                                            : 'Never expires'}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex shrink-0 items-center gap-1">
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
                                                    {copiedId === share.id ? (
                                                        <Check className="h-4 w-4 text-green-500" />
                                                    ) : (
                                                        <Copy className="h-4 w-4" />
                                                    )}
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                                    onClick={() =>
                                                        setShareToDelete(share)
                                                    }
                                                    title="Delete Link"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : null}
                    </div>
                </DialogContent>
            </Dialog>

            <AlertDialog
                open={!!shareToDelete}
                onOpenChange={(open) => !open && setShareToDelete(null)}
            >
                <AlertDialogContent className="rounded-2xl border-border bg-card">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-foreground">
                            Delete Share Link?
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-muted-foreground">
                            Are you sure you want to delete this share link?
                            Anyone with this link will no longer have access.
                            This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel
                            disabled={isDeleting}
                            className="border-border bg-card text-foreground hover:bg-muted hover:bg-muted/70"
                        >
                            Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => {
                                e.preventDefault();
                                confirmDeleteShare();
                            }}
                            className="border-0 bg-destructive text-white hover:bg-destructive/90"
                            disabled={isDeleting}
                        >
                            {isDeleting ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : null}
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
