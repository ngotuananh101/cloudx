import { useForm } from '@inertiajs/react';
import { type FormEvent, useEffect } from 'react';
import { updateName } from '@/actions/App/Http/Controllers/CloudConnectionController';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { CloudConnection } from '@/types/cloud';

interface EditConnectionNameDialogProps {
    connection: CloudConnection | null;
    onClose: () => void;
}

export default function EditConnectionNameDialog({ connection, onClose }: EditConnectionNameDialogProps) {
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
            <form onSubmit={submit} className="w-full max-w-sm rounded-3xl border border-gray-100 bg-white p-6 shadow-2xl">
                <div className="mb-5">
                    <h3 className="text-lg font-extrabold tracking-tight text-gray-900">Edit connection name</h3>
                    <p className="mt-1 text-xs font-medium text-gray-400">Update the display name shown in the sidebar.</p>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="connection-name">Name</Label>
                    <Input
                        id="connection-name"
                        value={form.data.name}
                        onChange={(event) => form.setData('name', event.target.value)}
                        maxLength={255}
                        autoFocus
                    />
                    {form.errors.name && <p className="text-xs font-semibold text-red-600">{form.errors.name}</p>}
                </div>

                <div className="mt-6 flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={onClose} disabled={form.processing}>
                        Cancel
                    </Button>
                    <Button type="submit" disabled={form.processing}>
                        Save
                    </Button>
                </div>
            </form>
        </div>
    );
}
