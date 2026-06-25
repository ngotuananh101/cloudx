import { router } from '@inertiajs/react';
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
import { destroy } from '@/routes/connections/items';
import type { CloudFile } from '@/types/cloud';

interface DeleteItemDialogProps {
    item: CloudFile | null;
    connectionId: number;
    onClose: () => void;
    onDeleted?: () => void;
}

export function DeleteItemDialog({
    item,
    connectionId,
    onClose,
    onDeleted,
}: DeleteItemDialogProps) {
    const deleteItem = () => {
        if (!item) {
            return;
        }

        router.delete(destroy.url({ connection: connectionId }), {
            data: {
                path: item.path,
                is_directory: item.isDirectory,
            },
            preserveScroll: true,
            onSuccess: () => {
                onClose();
                onDeleted?.();
            },
        });
    };

    return (
        <AlertDialog
            open={item !== null}
            onOpenChange={(open) => !open && onClose()}
        >
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>
                        Delete {item?.isDirectory ? 'folder' : 'file'}?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                        This will permanently remove{' '}
                        <span className="font-semibold break-all text-foreground">
                            "{item?.name}"
                        </span>{' '}
                        from your cloud storage. This action cannot be undone.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                        className="bg-destructive text-white hover:bg-destructive/90"
                        onClick={deleteItem}
                    >
                        Delete
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
