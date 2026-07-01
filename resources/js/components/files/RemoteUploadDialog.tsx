import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { RemoteUploadHeader, RemoteUploadRequest } from '@/types/cloud';

interface RemoteUploadDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (remoteUpload: RemoteUploadRequest) => void;
}

export function RemoteUploadDialog({
    isOpen,
    onClose,
    onSubmit,
}: RemoteUploadDialogProps) {
    const [url, setUrl] = useState('');
    const [filename, setFilename] = useState('');
    const [headers, setHeaders] = useState<RemoteUploadHeader[]>([]);
    const [error, setError] = useState<string | null>(null);

    const reset = () => {
        setUrl('');
        setFilename('');
        setHeaders([]);
        setError(null);
    };

    const handleOpenChange = (open: boolean) => {
        if (open) {
            return;
        }

        reset();
        onClose();
    };

    const addHeader = () => {
        setHeaders((currentHeaders) => [
            ...currentHeaders,
            { name: '', value: '' },
        ]);
    };

    const updateHeader = (
        index: number,
        field: keyof RemoteUploadHeader,
        value: string,
    ) => {
        setHeaders((currentHeaders) =>
            currentHeaders.map((header, currentIndex) =>
                currentIndex === index ? { ...header, [field]: value } : header,
            ),
        );
    };

    const removeHeader = (index: number) => {
        setHeaders((currentHeaders) =>
            currentHeaders.filter((_, currentIndex) => currentIndex !== index),
        );
    };

    const submit = () => {
        const trimmedUrl = url.trim();

        if (trimmedUrl === '') {
            setError('URL is required.');

            return;
        }

        const activeHeaders = headers.filter(
            (header) => header.name.trim() !== '' || header.value.trim() !== '',
        );

        const incompleteHeader = activeHeaders.find(
            (header) => header.name.trim() === '' || header.value.trim() === '',
        );

        if (incompleteHeader) {
            setError('Header rows need both a name and a value.');

            return;
        }

        onSubmit({
            url: trimmedUrl,
            filename: filename.trim() || undefined,
            headers: activeHeaders.map((header) => ({
                name: header.name.trim(),
                value: header.value.trim(),
            })),
        });

        reset();
        onClose();
    };

    const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        submit();
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleOpenChange}>
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Remote upload</DialogTitle>
                    <DialogDescription>
                        Import a file from a public URL. Add custom headers if
                        the source requires authorization.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="remote-upload-url">URL</Label>
                        <Input
                            id="remote-upload-url"
                            autoFocus
                            value={url}
                            onChange={(event) => setUrl(event.target.value)}
                            placeholder="https://example.com/file.zip"
                            className="h-11 rounded-xl"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="remote-upload-filename">
                            Save as (optional)
                        </Label>
                        <Input
                            id="remote-upload-filename"
                            value={filename}
                            onChange={(event) =>
                                setFilename(event.target.value)
                            }
                            placeholder="file.zip"
                            className="h-11 rounded-xl"
                        />
                    </div>

                    <div className="space-y-3">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <Label>Custom headers</Label>
                                <p className="mt-1 text-xs text-muted-foreground">
                                    Example: Authorization / Bearer token.
                                </p>
                            </div>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={addHeader}
                            >
                                <Plus className="h-4 w-4" />
                                Add header
                            </Button>
                        </div>

                        {headers.length > 0 && (
                            <div className="space-y-2">
                                {headers.map((header, index) => (
                                    <div
                                        key={index}
                                        className="grid grid-cols-[1fr_1fr_auto] gap-2"
                                    >
                                        <Input
                                            value={header.name}
                                            onChange={(event) =>
                                                updateHeader(
                                                    index,
                                                    'name',
                                                    event.target.value,
                                                )
                                            }
                                            placeholder="Header name"
                                            className="h-10 rounded-xl"
                                        />
                                        <Input
                                            value={header.value}
                                            onChange={(event) =>
                                                updateHeader(
                                                    index,
                                                    'value',
                                                    event.target.value,
                                                )
                                            }
                                            placeholder="Header value"
                                            className="h-10 rounded-xl"
                                        />
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon-sm"
                                            onClick={() => removeHeader(index)}
                                            aria-label="Remove header"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {error && (
                        <p className="text-sm text-destructive">{error}</p>
                    )}
                </form>

                <DialogFooter>
                    <Button type="button" variant="outline" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button type="button" onClick={submit}>
                        Start remote upload
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
