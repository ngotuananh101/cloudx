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

interface CreateFolderDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onCreate: (
        name: string,
    ) => string | null | undefined | Promise<string | null | undefined>;
}

export function CreateFolderDialog({
    isOpen,
    onClose,
    onCreate,
}: CreateFolderDialogProps) {
    const [folderName, setFolderName] = useState('');
    const [folderError, setFolderError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const reset = () => {
        setFolderName('');
        setFolderError(null);
    };

    const handleOpenChange = (open: boolean) => {
        if (open) {
            return;
        }

        reset();
        onClose();
    };

    const submit = async () => {
        if (submitting) {
            return;
        }

        setFolderError(null);
        setSubmitting(true);

        try {
            const result = await onCreate(folderName);

            if (result) {
                setFolderError(result);
            } else {
                reset();
                onClose();
            }
        } finally {
            setSubmitting(false);
        }
    };

    const handleFormSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        void submit();
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Create folder</DialogTitle>
                    <DialogDescription>
                        Add a new folder in the current cloud path.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleFormSubmit} className="space-y-2">
                    <Input
                        autoFocus
                        value={folderName}
                        onChange={(event) => setFolderName(event.target.value)}
                        placeholder="Folder name"
                        className="h-11 rounded-xl"
                    />
                    {folderError && (
                        <p className="text-sm text-destructive">{folderError}</p>
                    )}
                </form>

                <DialogFooter>
                    <Button type="button" variant="outline" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button
                        type="submit"
                        onClick={() => {
                            void submit();
                        }}
                        disabled={folderName.length === 0 || submitting}
                    >
                        Create
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
