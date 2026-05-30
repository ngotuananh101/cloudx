import { router, useForm } from '@inertiajs/react';
import { ChevronDown } from 'lucide-react';
import { type FormEvent, useEffect, useState } from 'react';
import { update } from '@/routes/connections/ftp';
import type { CloudConnection } from '@/types/cloud';

interface EditFtpConnectionDialogProps {
    connection: CloudConnection | null;
    onClose: () => void;
}

type IgnorePassiveAddress = '' | 'true' | 'false';
type SystemType = 'auto' | 'unix' | 'windows';

interface FtpConnectionFormData {
    name: string;
    host: string;
    port: string;
    username: string;
    password: string;
    root: string;
    ssl: boolean;
    passive: boolean;
    timeout: string;
    utf8: boolean;
    ignorePassiveAddress: IgnorePassiveAddress;
    systemType: SystemType;
    recurseManually: boolean;
    timestampsOnUnixListingsEnabled: boolean;
}

const booleanOptions = [
    { label: 'Default', value: '' },
    { label: 'Yes', value: 'true' },
    { label: 'No', value: 'false' },
] as const;

const systemTypeOptions = [
    { label: 'Auto', value: 'auto' },
    { label: 'Unix', value: 'unix' },
    { label: 'Windows', value: 'windows' },
] as const;

export default function EditFtpConnectionDialog({
    connection,
    onClose,
}: EditFtpConnectionDialogProps) {
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [processing, setProcessing] = useState(false);
    const form = useForm<FtpConnectionFormData>(initialData(connection));

    useEffect(() => {
        form.setData(initialData(connection));
        form.clearErrors();
        setShowAdvanced(false);
    }, [connection?.id]);

    if (!connection) {
        return null;
    }

    const submit = (event: FormEvent<HTMLFormElement>) => {
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
            <form
                onSubmit={submit}
                className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-gray-100 bg-white p-6 shadow-2xl"
            >
                <div className="mb-5">
                    <h3 className="text-lg font-extrabold tracking-tight text-gray-900">
                        Edit FTP connection
                    </h3>
                    <p className="mt-1 text-xs font-medium text-gray-400">
                        Update server settings. Leave password blank to keep the
                        current password.
                    </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Name" error={form.errors.name} required>
                        <input
                            id="edit-ftp-name"
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
                            id="edit-ftp-host"
                            value={form.data.host}
                            onChange={(event) =>
                                form.setData('host', event.target.value)
                            }
                            className={inputClassName}
                            aria-invalid={Boolean(form.errors.host)}
                            placeholder="ftp.example.com"
                        />
                    </Field>

                    <Field label="Port" error={form.errors.port} required>
                        <input
                            id="edit-ftp-port"
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
                            id="edit-ftp-username"
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
                            id="edit-ftp-password"
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
                            id="edit-ftp-root"
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

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <CheckboxField
                        label="Use SSL"
                        checked={form.data.ssl}
                        onChange={(checked) => form.setData('ssl', checked)}
                        error={form.errors.ssl}
                    />
                    <CheckboxField
                        label="Passive mode"
                        checked={form.data.passive}
                        onChange={(checked) => form.setData('passive', checked)}
                        error={form.errors.passive}
                    />
                </div>

                <div className="mt-5 rounded-2xl border border-gray-100 bg-gray-50/50">
                    <button
                        type="button"
                        onClick={() => setShowAdvanced((current) => !current)}
                        className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-bold text-gray-700"
                        aria-expanded={showAdvanced}
                        aria-controls="edit-ftp-advanced-settings"
                    >
                        Advanced settings
                        <ChevronDown
                            className={`h-4 w-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`}
                            aria-hidden="true"
                        />
                    </button>

                    {showAdvanced && (
                        <div
                            id="edit-ftp-advanced-settings"
                            className="grid gap-4 border-t border-gray-100 p-4 sm:grid-cols-2"
                        >
                            <Field label="Timeout" error={form.errors.timeout}>
                                <input
                                    id="edit-ftp-timeout"
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
                                    placeholder="30"
                                />
                            </Field>

                            <Field
                                label="Ignore passive address"
                                error={form.errors.ignorePassiveAddress}
                            >
                                <select
                                    id="edit-ftp-ignore-passive-address"
                                    value={form.data.ignorePassiveAddress}
                                    onChange={(event) =>
                                        form.setData(
                                            'ignorePassiveAddress',
                                            event.target
                                                .value as IgnorePassiveAddress,
                                        )
                                    }
                                    className={inputClassName}
                                >
                                    {booleanOptions.map((option) => (
                                        <option
                                            key={option.label}
                                            value={option.value}
                                        >
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                            </Field>

                            <Field
                                label="System type"
                                error={form.errors.systemType}
                            >
                                <select
                                    id="edit-ftp-system-type"
                                    value={form.data.systemType}
                                    onChange={(event) =>
                                        form.setData(
                                            'systemType',
                                            event.target.value as SystemType,
                                        )
                                    }
                                    className={inputClassName}
                                >
                                    {systemTypeOptions.map((option) => (
                                        <option
                                            key={option.value}
                                            value={option.value}
                                        >
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                            </Field>

                            <CheckboxField
                                label="UTF-8"
                                checked={form.data.utf8}
                                onChange={(checked) =>
                                    form.setData('utf8', checked)
                                }
                                error={form.errors.utf8}
                            />
                            <CheckboxField
                                label="Recurse manually"
                                checked={form.data.recurseManually}
                                onChange={(checked) =>
                                    form.setData('recurseManually', checked)
                                }
                                error={form.errors.recurseManually}
                            />
                            <CheckboxField
                                label="Unix listing timestamps"
                                checked={
                                    form.data.timestampsOnUnixListingsEnabled
                                }
                                onChange={(checked) =>
                                    form.setData(
                                        'timestampsOnUnixListingsEnabled',
                                        checked,
                                    )
                                }
                                error={
                                    form.errors.timestampsOnUnixListingsEnabled
                                }
                            />
                        </div>
                    )}
                </div>

                <div className="mt-6 flex justify-end gap-2">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={processing}
                        className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-bold text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-60"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={processing}
                        className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
                    >
                        {processing ? 'Testing connection...' : 'Save'}
                    </button>
                </div>
            </form>
        </div>
    );
}

function initialData(
    connection: CloudConnection | null,
): FtpConnectionFormData {
    const config = connection?.ftp_config;

    return {
        name: connection?.name ?? '',
        host: config?.host ?? '',
        port: String(config?.port ?? 21),
        username: config?.username ?? '',
        password: '',
        root: config?.root ?? '',
        ssl: config?.ssl ?? false,
        passive: config?.passive ?? true,
        timeout: config?.timeout ? String(config.timeout) : '',
        utf8: config?.utf8 ?? false,
        ignorePassiveAddress:
            config?.ignore_passive_address === undefined ||
            config?.ignore_passive_address === null
                ? ''
                : config.ignore_passive_address
                  ? 'true'
                  : 'false',
        systemType: config?.system_type ?? 'auto',
        recurseManually: config?.recurse_manually ?? false,
        timestampsOnUnixListingsEnabled:
            config?.timestamps_on_unix_listings_enabled ?? true,
    };
}

function payload(data: FtpConnectionFormData) {
    return {
        ...data,
        port: Number(data.port),
        root: data.root || null,
        timeout: data.timeout ? Number(data.timeout) : null,
        ignorePassiveAddress:
            data.ignorePassiveAddress === ''
                ? null
                : data.ignorePassiveAddress === 'true',
        systemType: data.systemType === 'auto' ? null : data.systemType,
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
            <label htmlFor={id} className="text-xs font-bold text-gray-600">
                {label}
                {required && <span className="text-red-500"> *</span>}
            </label>
            {children}
            {error && (
                <p
                    id={id ? `${id}-error` : undefined}
                    className="text-xs font-semibold text-red-600"
                >
                    {error}
                </p>
            )}
        </div>
    );
}

function CheckboxField({
    label,
    checked,
    onChange,
    error,
}: {
    label: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
    error?: string;
}) {
    return (
        <div className="space-y-1">
            <label className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white px-3 py-2 text-sm font-bold text-gray-700">
                <input
                    type="checkbox"
                    checked={checked}
                    onChange={(event) => onChange(event.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                {label}
            </label>
            {error && (
                <p className="text-xs font-semibold text-red-600">{error}</p>
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
    'h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-medium text-gray-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100';
