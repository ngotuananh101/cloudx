import { useState, useEffect } from 'react';
import { router } from '@inertiajs/react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Copy, Trash2, Globe, Lock, Loader2, Check } from 'lucide-react';
import type { CloudFile } from '@/types/cloud';
import connections from '@/routes/connections';

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

    useEffect(() => {
        if (!isOpen || !item) {
            setShares([]);
            setError(null);
            setType('public');
            setPassword('');
            setExpiresInDays('0');
            return;
        }

        fetchShares();
    }, [isOpen, item, connectionId]);

    const fetchShares = async () => {
        if (!item) return;
        
        setIsLoadingShares(true);
        try {
            const url = `${connections.shares.index.url({ connection: connectionId })}?path=${encodeURIComponent(item.path)}`;
            const response = await fetch(url);
            if (!response.ok) throw new Error('Failed to fetch shares');
            const data = await response.json();
            setShares(data);
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoadingShares(false);
        }
    };

    const handleCreateShare = () => {
        if (!item) return;

        setError(null);
        setIsSubmitting(true);

        const data = {
            path: item.path,
            name: item.name,
            is_directory: item.isDirectory,
            type: type,
            password: type === 'password' ? password : null,
            expires_in_days: expiresInDays === '0' ? null : parseInt(expiresInDays, 10),
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
            }
        );
    };

    const handleDeleteShare = (shareId: number, uuid: string) => {
        router.delete(
            connections.shares.destroy.url({ connection: connectionId, share: shareId }),
            {
                preserveScroll: true,
                onSuccess: () => {
                    setShares(shares.filter(s => s.id !== shareId));
                }
            }
        );
    };

    const handleCopy = (id: number, uuid: string) => {
        const url = `${window.location.origin}/s/${uuid}`;
        navigator.clipboard.writeText(url);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-md bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800 rounded-3xl p-6 shadow-2xl">
                <DialogHeader className="mb-4">
                    <DialogTitle className="text-gray-900 dark:text-gray-100">
                        Share "{item?.name}"
                    </DialogTitle>
                    <DialogDescription className="text-gray-500 dark:text-gray-400">
                        Create a link to share this item with others.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6">
                    {/* Create Share Form */}
                    <div className="space-y-4 rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50 p-4">
                        <div className="space-y-3">
                            <Label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Access Type</Label>
                            <RadioGroup
                                value={type}
                                onValueChange={(val) => setType(val as 'public' | 'password')}
                                className="flex flex-col space-y-1"
                            >
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="public" id="r-public" />
                                    <Label htmlFor="r-public" className="flex items-center gap-2 cursor-pointer font-medium text-gray-700 dark:text-gray-300">
                                        <Globe className="h-4 w-4 text-blue-500" />
                                        Public (Anyone with link)
                                    </Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="password" id="r-password" />
                                    <Label htmlFor="r-password" className="flex items-center gap-2 cursor-pointer font-medium text-gray-700 dark:text-gray-300">
                                        <Lock className="h-4 w-4 text-amber-500" />
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
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Enter a secure password"
                                    className="h-10 border-0 bg-white dark:bg-gray-900"
                                />
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label>Expiration</Label>
                            <Select value={expiresInDays} onValueChange={setExpiresInDays}>
                                <SelectTrigger className="h-10 border-0 bg-white dark:bg-gray-900">
                                    <SelectValue placeholder="Select expiration" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="0">Never expires</SelectItem>
                                    <SelectItem value="1">1 Day</SelectItem>
                                    <SelectItem value="7">7 Days</SelectItem>
                                    <SelectItem value="30">30 Days</SelectItem>
                                    <SelectItem value="90">90 Days</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {error && <p className="text-sm text-red-500 font-medium">{error}</p>}

                        <Button
                            onClick={handleCreateShare}
                            disabled={isSubmitting || (type === 'password' && password.length < 4)}
                            className="w-full bg-blue-600 text-white hover:bg-blue-700"
                        >
                            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Create Share Link
                        </Button>
                    </div>

                    {/* Existing Shares List */}
                    {isLoadingShares ? (
                        <div className="flex justify-center p-4">
                            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                        </div>
                    ) : shares.length > 0 ? (
                        <div className="space-y-3">
                            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Active Links</h4>
                            <div className="space-y-2">
                                {shares.map((share) => (
                                    <div key={share.id} className="flex items-center justify-between rounded-lg border border-gray-100 dark:border-gray-800 p-3 bg-white dark:bg-gray-900">
                                        <div className="flex flex-col min-w-0 pr-2">
                                            <div className="flex items-center gap-2 mb-1">
                                                {share.type === 'public' ? (
                                                    <Globe className="h-3 w-3 text-blue-500 shrink-0" />
                                                ) : (
                                                    <Lock className="h-3 w-3 text-amber-500 shrink-0" />
                                                )}
                                                <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                                                    {window.location.origin}/s/{share.uuid}
                                                </span>
                                            </div>
                                            <span className="text-xs text-gray-500 dark:text-gray-400">
                                                Created {new Date(share.created_at).toLocaleDateString()}
                                                {share.expires_at ? ` · Expires ${new Date(share.expires_at).toLocaleDateString()}` : ' · Never expires'}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1 shrink-0">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-gray-500 hover:text-blue-600 dark:hover:text-blue-400"
                                                onClick={() => handleCopy(share.id, share.uuid)}
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
                                                className="h-8 w-8 text-gray-500 hover:text-red-600 dark:hover:text-red-400"
                                                onClick={() => handleDeleteShare(share.id, share.uuid)}
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
    );
}
