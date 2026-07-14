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
import type { CloudFile } from '@/types/cloud';
import { destroy } from '@/routes/connections/items';

interface DeleteItemDialogProps {
    item?: CloudFile | null;
    items?: CloudFile[];
    connectionId: number;
    onClose: () => void;
    onDeleted?: () => void;
}

function resolveSelectedItems(
    items: CloudFile[],
    item: CloudFile | null,
): CloudFile[] {
    if (items.length > 0) {
        return items;
    }

    return item ? [item] : [];
}

export function DeleteItemDialog({
    item = null,
    items = [],
    connectionId,
    onClose,
    onDeleted,
}: Readonly<DeleteItemDialogProps>) {
    const selectedItems = resolveSelectedItems(items, item);
    const targetItem = selectedItems[0] ?? null;
    const isBulkDelete = selectedItems.length > 1;
    const itemTypeLabel = targetItem?.isDirectory ? 'folder' : 'file';

    const deleteItem = () => {
        if (selectedItems.length === 0) {
            return;
        }

        router.delete(destroy.url({ connection: connectionId }), {
            data:
                selectedItems.length === 1
                    ? {
                          path: selectedItems[0].path,
                          is_directory: selectedItems[0].isDirectory,
                      }
                    : {
                          items: selectedItems.map((selectedItem) => ({
                              path: selectedItem.path,
                              is_directory: selectedItem.isDirectory,
                          })),
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
            open={selectedItems.length > 0}
            onOpenChange={(open) => !open && onClose()}
        >
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>
                        {isBulkDelete
                            ? `Delete ${selectedItems.length} items?`
                            : `Delete ${itemTypeLabel}?`}
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                        {isBulkDelete ? (
                            <>
                                This will permanently remove{' '}
                                <span className="font-semibold text-foreground">
                                    {selectedItems.length} selected items
                                </span>{' '}
                                from your cloud storage. This action cannot be
                                undone.
                            </>
                        ) : (
                            <>
                                This will permanently remove{' '}
                                <span className="font-semibold break-all text-foreground">
                                    "{targetItem?.name}"
                                </span>{' '}
                                from your cloud storage. This action cannot be
                                undone.
                            </>
                        )}
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
