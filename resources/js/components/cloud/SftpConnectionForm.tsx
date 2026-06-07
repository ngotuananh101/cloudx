import { router, useForm } from '@inertiajs/react';
import { ChevronDown } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { store } from '@/routes/connections/sftp';

interface SftpConnectionFormProps {
    onCancel: () => void;
    onSuccess: () => void;
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

export default function SftpConnectionForm({
    onCancel,
    onSuccess,
}: SftpConnectionFormProps) {
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [processing, setProcessing] = useState(false);
    const form = useForm<SftpConnectionFormData>({
        name: '',
        host: '',
        port: '22',
        username: '',
        password: '',
        root: '',
        privateKey: '',
        passphrase: '',
        hostFingerprint: '',
        timeout: '10',
        maxTries: '4',
    });

    const submit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        router.post(store.url(), payload(form.data), {
            preserveScroll: true,
            onBefore: () => {
                form.clearErrors();
                setProcessing(true);
            },
            onError: (errors) => form.setError(errors),
            onFinish: () => setProcessing(false),
            onSuccess,
        });
    };

    return (
        <form onSubmit={submit} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Name" error={form.errors.name} required>
                    <input
                        id="sftp-name"
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
                        id="sftp-host"
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
                        id="sftp-port"
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

                <Field label="Username" error={form.errors.username} required>
                    <input
                        id="sftp-username"
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
                        id="sftp-password"
                        type="password"
                        value={form.data.password}
                        onChange={(event) =>
                            form.setData('password', event.target.value)
                        }
                        className={inputClassName}
                        aria-invalid={Boolean(form.errors.password)}
                    />
                </Field>

                <Field label="Root" error={form.errors.root}>
                    <input
                        id="sftp-root"
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

            <div className="space-y-4 rounded-2xl border border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50 p-4">
                <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300">Key Authentication</h4>
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="col-span-2">
                        <Field label="Private Key" error={form.errors.privateKey}>
                            <textarea
                                id="sftp-private-key"
                                value={form.data.privateKey}
                                onChange={(event) =>
                                    form.setData('privateKey', event.target.value)
                                }
                                className="w-full rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm font-medium text-gray-900 dark:text-gray-100 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/50 font-mono"
                                rows={4}
                                placeholder="-----BEGIN RSA PRIVATE KEY-----..."
                            />
                        </Field>
                    </div>
                    <Field label="Passphrase" error={form.errors.passphrase}>
                        <input
                            id="sftp-passphrase"
                            type="password"
                            value={form.data.passphrase}
                            onChange={(event) =>
                                form.setData('passphrase', event.target.value)
                            }
                            className={inputClassName}
                            aria-invalid={Boolean(form.errors.passphrase)}
                        />
                    </Field>
                </div>
            </div>

            <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50">
                <button
                    type="button"
                    onClick={() => setShowAdvanced((current) => !current)}
                    className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-bold text-gray-700 dark:text-gray-300"
                    aria-expanded={showAdvanced}
                    aria-controls="sftp-advanced-settings"
                >
                    Advanced settings
                    <ChevronDown
                        className={`h-4 w-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`}
                        aria-hidden="true"
                    />
                </button>

                {showAdvanced && (
                    <div
                        id="sftp-advanced-settings"
                        className="grid gap-4 border-t border-gray-100 dark:border-gray-800 p-4 sm:grid-cols-2"
                    >
                        <Field label="Host Fingerprint" error={form.errors.hostFingerprint}>
                            <input
                                id="sftp-host-fingerprint"
                                value={form.data.hostFingerprint}
                                onChange={(event) =>
                                    form.setData('hostFingerprint', event.target.value)
                                }
                                className={inputClassName}
                                aria-invalid={Boolean(form.errors.hostFingerprint)}
                            />
                        </Field>

                        <Field label="Timeout" error={form.errors.timeout}>
                            <input
                                id="sftp-timeout"
                                type="number"
                                min="1"
                                max="300"
                                value={form.data.timeout}
                                onChange={(event) =>
                                    form.setData('timeout', event.target.value)
                                }
                                className={inputClassName}
                                placeholder="10"
                            />
                        </Field>

                        <Field label="Max Tries" error={form.errors.maxTries}>
                            <input
                                id="sftp-max-tries"
                                type="number"
                                min="1"
                                max="10"
                                value={form.data.maxTries}
                                onChange={(event) =>
                                    form.setData('maxTries', event.target.value)
                                }
                                className={inputClassName}
                                placeholder="4"
                            />
                        </Field>
                    </div>
                )}
            </div>

            <div className="flex justify-end gap-2">
                <button
                    type="button"
                    onClick={onCancel}
                    disabled={processing}
                    className="rounded-md border border-gray-200 dark:border-gray-700 px-4 py-2 text-sm font-bold text-gray-600 dark:text-gray-400 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-60"
                >
                    Back
                </button>
                <button
                    type="submit"
                    disabled={processing}
                    className="rounded-md bg-blue-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
                >
                    {processing ? 'Testing connection...' : 'Connect SFTP'}
                </button>
            </div>
        </form>
    );
}

function payload(data: SftpConnectionFormData) {
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
}: {
    label: string;
    error?: string;
    required?: boolean;
    children: React.ReactNode;
}) {
    const id = getChildId(children);

    return (
        <div className="space-y-2">
            <label htmlFor={id} className="text-xs font-bold text-gray-600 dark:text-gray-400">
                {label}
                {required && <span className="text-red-500"> *</span>}
            </label>
            {children}
            {error && (
                <p
                    id={id ? `${id}-error` : undefined}
                    className="text-xs text-red-600 dark:text-red-400"
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
    'h-10 w-full rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 text-sm font-medium text-gray-900 dark:text-gray-100 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/50';
