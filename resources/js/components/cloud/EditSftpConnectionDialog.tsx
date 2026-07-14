import { router, useForm } from '@inertiajs/react';
import { ChevronDown } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import type { CloudConnection } from '@/types/cloud';
import { update } from '@/routes/connections/sftp';

interface EditSftpConnectionDialogProps {
    connection: CloudConnection | null;
    onClose: () => void;
}

interface SftpConnectionFormData {
    name: string;
    host: string;
    port: string;
    username: string;
    password: string;
    root: string;
    privateKey: string;
    passphrase: string;
    hostFingerprint: string;
    timeout: string;
    maxTries: string;
}

export default function EditSftpConnectionDialog({
    connection,
    onClose,
}: Readonly<EditSftpConnectionDialogProps>) {
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [processing, setProcessing] = useState(false);
    const form = useForm<SftpConnectionFormData>(initialData(connection));

    useEffect(() => {
        form.setData(initialData(connection));
        form.clearErrors();
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setShowAdvanced(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [connection?.id]);

    if (!connection) {
        return null;
    }

    const submit = (event: Readonly<FormEvent<HTMLFormElement>>) => {
        event.preventDefault();

        router.patch(
            update.url({ connection: connection.id }),
            payload(form.data),
            {
                preserveScroll: true,
                onBefore: () => {
                    form.clearErrors();
                    setProcessing(true);
                },
                onError: (errors) => form.setError(errors),
                onFinish: () => setProcessing(false),
                onSuccess: onClose,
            },
        );
    };

    return (
        <Dialog
            open={connection !== null}
            onOpenChange={(open) => !open && onClose()}
        >
            <DialogContent className="max-h-[90vh] overflow-y-auto rounded-3xl border-border bg-card p-0 shadow-2xl sm:max-w-2xl [&>button]:top-6 [&>button]:right-6 [&>button]:z-10">
                <form onSubmit={submit} className="p-6">
                    <DialogHeader className="mb-5 text-left">
                        <DialogTitle className="text-lg font-extrabold tracking-tight text-foreground">
                            Edit SFTP connection
                        </DialogTitle>
                        <DialogDescription className="mt-1 text-xs text-muted-foreground">
                            Update server settings. Leave password/keys blank to
                            keep the current credentials.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <Field label="Name" error={form.errors.name} required>
                            <input
                                id="edit-sftp-name"
                                value={form.data.name}
                                onChange={(event) =>
                                    form.setData('name', event.target.value)
                                }
                                className={inputClassName}
                                aria-invalid={Boolean(form.errors.name)}
                                autoFocus
                            />
                        </Field>

                        <Field label="Host" error={form.errors.host} required>
                            <input
                                id="edit-sftp-host"
                                value={form.data.host}
                                onChange={(event) =>
                                    form.setData('host', event.target.value)
                                }
                                className={inputClassName}
                                aria-invalid={Boolean(form.errors.host)}
                                placeholder="sftp.example.com"
                            />
                        </Field>

                        <Field label="Port" error={form.errors.port} required>
                            <input
                                id="edit-sftp-port"
                                type="number"
                                min="1"
                                max="65535"
                                value={form.data.port}
                                onChange={(event) =>
                                    form.setData('port', event.target.value)
                                }
                                className={inputClassName}
                                aria-invalid={Boolean(form.errors.port)}
                            />
                        </Field>

                        <Field
                            label="Username"
                            error={form.errors.username}
                            required
                        >
                            <input
                                id="edit-sftp-username"
                                value={form.data.username}
                                onChange={(event) =>
                                    form.setData('username', event.target.value)
                                }
                                className={inputClassName}
                                aria-invalid={Boolean(form.errors.username)}
                            />
                        </Field>

                        <Field label="Password" error={form.errors.password}>
                            <input
                                id="edit-sftp-password"
                                type="password"
                                value={form.data.password}
                                onChange={(event) =>
                                    form.setData('password', event.target.value)
                                }
                                className={inputClassName}
                                aria-invalid={Boolean(form.errors.password)}
                                placeholder="Leave blank to keep current password"
                            />
                        </Field>

                        <Field label="Root" error={form.errors.root}>
                            <input
                                id="edit-sftp-root"
                                value={form.data.root}
                                onChange={(event) =>
                                    form.setData('root', event.target.value)
                                }
                                className={inputClassName}
                                aria-invalid={Boolean(form.errors.root)}
                                placeholder="/"
                            />
                        </Field>
                    </div>

                    <div className="mt-5 space-y-4 rounded-2xl border border-border bg-muted/50 p-4">
                        <h4 className="text-sm font-bold text-foreground">
                            Key Authentication
                        </h4>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="col-span-2">
                                <Field
                                    label="Private Key"
                                    error={form.errors.privateKey}
                                >
                                    <textarea
                                        id="edit-sftp-private-key"
                                        value={form.data.privateKey}
                                        onChange={(event) =>
                                            form.setData(
                                                'privateKey',
                                                event.target.value,
                                            )
                                        }
                                        className="w-full rounded-md border border-border bg-card px-3 py-2 font-mono text-sm font-medium text-foreground transition outline-none focus:border-ring focus:ring-2 focus:ring-ring/50"
                                        rows={4}
                                        placeholder="Leave blank to keep current private key"
                                    />
                                </Field>
                            </div>
                            <Field
                                label="Passphrase"
                                error={form.errors.passphrase}
                            >
                                <input
                                    id="edit-sftp-passphrase"
                                    type="password"
                                    value={form.data.passphrase}
                                    onChange={(event) =>
                                        form.setData(
                                            'passphrase',
                                            event.target.value,
                                        )
                                    }
                                    className={inputClassName}
                                    aria-invalid={Boolean(
                                        form.errors.passphrase,
                                    )}
                                    placeholder="Leave blank to keep current passphrase"
                                />
                            </Field>
                        </div>
                    </div>

                    <div className="mt-5 rounded-2xl border border-border bg-muted/50">
                        <button
                            type="button"
                            onClick={() =>
                                setShowAdvanced((current) => !current)
                            }
                            className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-bold text-foreground"
                            aria-expanded={showAdvanced}
                            aria-controls="edit-sftp-advanced-settings"
                        >
                            Advanced settings
                            <ChevronDown
                                className={`h-4 w-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`}
                                aria-hidden="true"
                            />
                        </button>

                        {showAdvanced && (
                            <div
                                id="edit-sftp-advanced-settings"
                                className="grid gap-4 border-t border-border p-4 sm:grid-cols-2"
                            >
                                <Field
                                    label="Host Fingerprint"
                                    error={form.errors.hostFingerprint}
                                >
                                    <input
                                        id="edit-sftp-host-fingerprint"
                                        value={form.data.hostFingerprint}
                                        onChange={(event) =>
                                            form.setData(
                                                'hostFingerprint',
                                                event.target.value,
                                            )
                                        }
                                        className={inputClassName}
                                        aria-invalid={Boolean(
                                            form.errors.hostFingerprint,
                                        )}
                                    />
                                </Field>

                                <Field
                                    label="Timeout"
                                    error={form.errors.timeout}
                                >
                                    <input
                                        id="edit-sftp-timeout"
                                        type="number"
                                        min="1"
                                        max="300"
                                        value={form.data.timeout}
                                        onChange={(event) =>
                                            form.setData(
                                                'timeout',
                                                event.target.value,
                                            )
                                        }
                                        className={inputClassName}
                                        placeholder="10"
                                    />
                                </Field>

                                <Field
                                    label="Max Tries"
                                    error={form.errors.maxTries}
                                >
                                    <input
                                        id="edit-sftp-max-tries"
                                        type="number"
                                        min="1"
                                        max="10"
                                        value={form.data.maxTries}
                                        onChange={(event) =>
                                            form.setData(
                                                'maxTries',
                                                event.target.value,
                                            )
                                        }
                                        className={inputClassName}
                                        placeholder="4"
                                    />
                                </Field>
                            </div>
                        )}
                    </div>

                    <div className="mt-6 flex justify-end gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={processing}
                            className="rounded-md border border-border px-4 py-2 text-sm font-bold text-foreground transition-colors hover:bg-muted hover:bg-muted/70 disabled:opacity-60"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={processing}
                            className="rounded-md bg-primary px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-primary/90 disabled:opacity-60"
                        >
                            {processing ? 'Testing connection...' : 'Save'}
                        </button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function initialData(
    connection: CloudConnection | null,
): SftpConnectionFormData {
    const config = connection?.sftp_config;

    return {
        name: connection?.name ?? '',
        host: config?.host ?? '',
        port: String(config?.port ?? 22),
        username: config?.username ?? '',
        password: '',
        root: config?.root ?? '',
        privateKey: '',
        passphrase: '',
        hostFingerprint: config?.hostFingerprint ?? '',
        timeout: config?.timeout ? String(config.timeout) : '',
        maxTries: config?.maxTries ? String(config.maxTries) : '',
    };
}

function payload(data: Readonly<SftpConnectionFormData>) {
    return {
        ...data,
        port: Number(data.port),
        root: data.root || null,
        privateKey: data.privateKey || null,
        passphrase: data.passphrase || null,
        hostFingerprint: data.hostFingerprint || null,
        timeout: data.timeout ? Number(data.timeout) : null,
        maxTries: data.maxTries ? Number(data.maxTries) : null,
    };
}

function Field({
    label,
    error,
    required = false,
    children,
}: Readonly<{
    label: string;
    error?: string;
    required?: boolean;
    children: React.ReactNode;
}>) {
    const id = getChildId(children);

    return (
        <div className="space-y-2">
            <label htmlFor={id} className="text-xs font-bold text-foreground">
                {label}
                {required && <span className="text-destructive"> *</span>}
            </label>
            {children}
            {error && (
                <p
                    id={id ? `${id}-error` : undefined}
                    className="text-xs text-destructive"
                >
                    {error}
                </p>
            )}
        </div>
    );
}

function getChildId(children: React.ReactNode): string | undefined {
    if (!children || typeof children !== 'object' || !('props' in children)) {
        return undefined;
    }

    return (children.props as { id?: string }).id;
}

const inputClassName =
    'h-10 w-full rounded-md border border-border bg-card px-3 text-sm font-medium text-foreground outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/50';
