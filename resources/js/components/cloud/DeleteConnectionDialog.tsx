import { router } from '@inertiajs/react';
import { disconnect } from '@/actions/App/Http/Controllers/CloudConnectionController';
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
import type { CloudConnection } from '@/types/cloud';

interface DeleteConnectionDialogProps {
    connection: CloudConnection | null;
    onClose: () => void;
}

export default function DeleteConnectionDialog({
    connection,
    onClose,
}: DeleteConnectionDialogProps) {
    const deleteConnection = () => {
        if (!connection) {
            return;
        }

        router.delete(disconnect.url(connection), {
            preserveScroll: true,
            onFinish: onClose,
        });
    };

    return (
        <AlertDialog
            open={connection !== null}
            onOpenChange={(open) => !open && onClose()}
        >
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Delete connection?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This will remove {connection?.name} from your connected
                        storage list. You can reconnect it later through OAuth.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                        className="bg-destructive text-white hover:bg-destructive/90"
                        onClick={deleteConnection}
                    >
                        Delete connection
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
