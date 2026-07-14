import { Cloud, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import type { UploadMode } from '@/types/cloud';

interface UploadModeDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (mode: Readonly<UploadMode>) => void;
}

export function UploadModeDialog({
    isOpen,
    onClose,
    onSelect,
}: Readonly<UploadModeDialogProps>) {
    const handleBackend = () => {
        onSelect('backend');
        onClose();
    };

    const handleDirect = () => {
        onSelect('direct');
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Choose Upload Mode</DialogTitle>
                    <DialogDescription>
                        Select how you want to upload your files
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    <button
                        type="button"
                        onClick={handleBackend}
                        className="flex items-start gap-4 rounded-lg border border-border p-4 text-left transition-colors hover:bg-accent hover:text-accent-foreground"
                    >
                        <div className="rounded-lg bg-primary/10 p-2">
                            <Cloud className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1">
                            <div className="font-semibold">Backend Upload</div>
                            <div className="text-sm text-muted-foreground">
                                Upload through the server (Default)
                            </div>
                        </div>
                    </button>

                    <button
                        type="button"
                        onClick={handleDirect}
                        className="flex items-start gap-4 rounded-lg border border-border p-4 text-left transition-colors hover:bg-accent hover:text-accent-foreground"
                    >
                        <div className="rounded-lg bg-accent/10 p-2">
                            <Zap className="h-5 w-5 text-accent" />
                        </div>
                        <div className="flex-1">
                            <div className="font-semibold">Direct Upload</div>
                            <div className="text-sm text-muted-foreground">
                                Upload directly to S3 (Faster)
                            </div>
                        </div>
                    </button>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>
                        Cancel
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
