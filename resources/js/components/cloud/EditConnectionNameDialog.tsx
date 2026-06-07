import { useForm } from '@inertiajs/react';
import { type FormEvent, useEffect } from 'react';
import { updateName } from '@/actions/App/Http/Controllers/CloudConnectionController';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import type { CloudConnection } from '@/types/cloud';

interface EditConnectionNameDialogProps {
    connection: CloudConnection | null;
    onClose: () => void;
}

export default function EditConnectionNameDialog({
    connection,
    onClose,
}: EditConnectionNameDialogProps) {
    const form = useForm({
        name: connection?.name ?? '',
    });

    useEffect(() => {
        form.setData('name', connection?.name ?? '');
        form.clearErrors();
    }, [connection?.id]);

    if (!connection) {
        return null;
    }

    const submit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        form.patch(updateName.url(connection), {
            preserveScroll: true,
            onSuccess: onClose,
        });
    };

    return (
        <Dialog open={connection !== null} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-sm rounded-3xl p-6 shadow-2xl bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800">
                <form onSubmit={submit}>
                    <DialogHeader className="mb-5">
                        <DialogTitle className="text-lg font-extrabold tracking-tight text-gray-900 dark:text-gray-100">
                            Edit connection name
                        </DialogTitle>
                        <DialogDescription className="mt-1 text-xs text-gray-400">
                            Update the display name shown in the sidebar.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-2">
                        <Label htmlFor="connection-name">Name</Label>
                        <Input
                            id="connection-name"
                            value={form.data.name}
                            onChange={(event) =>
                                form.setData('name', event.target.value)
                            }
                            maxLength={255}
                            autoFocus
                        />
                        {form.errors.name && (
                            <p className="text-xs text-red-600 dark:text-red-400">
                                {form.errors.name}
                            </p>
                        )}
                    </div>

                    <DialogFooter className="mt-6 flex justify-end gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onClose}
                            disabled={form.processing}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" disabled={form.processing}>
                            Save
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
