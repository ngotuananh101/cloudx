import { router, useForm } from '@inertiajs/react';
import { ChevronDown } from 'lucide-react';
import {  useEffect, useState } from 'react';
import type {FormEvent} from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { update } from '@/routes/connections/ftp';
import type { CloudConnection } from '@/types/cloud';

interface EditFtpConnectionDialogProps {
    connection: CloudConnection | null;
    onClose: () => void;
}

type IgnorePassiveAddress = 'default' | 'true' | 'false';
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
    { label: 'Default', value: 'default' },
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
        <Dialog open={connection !== null} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-h-[90vh] sm:max-w-2xl overflow-y-auto rounded-3xl p-0 shadow-2xl bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800 [&>button]:right-6 [&>button]:top-6 [&>button]:z-10">
                <form onSubmit={submit} className="p-6">
                    <DialogHeader className="mb-5 text-left">
                        <DialogTitle className="text-lg font-extrabold tracking-tight text-gray-900 dark:text-gray-100">
                            Edit FTP connection
                        </DialogTitle>
                        <DialogDescription className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                            Update server settings. Leave password blank to keep the
                            current password.
                        </DialogDescription>
                    </DialogHeader>

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

                <div className="mt-5 rounded-2xl border border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50">
                    <button
                        type="button"
                        onClick={() => setShowAdvanced((current) => !current)}
                        className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-bold text-gray-700 dark:text-gray-300"
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
                            className="grid gap-4 border-t border-gray-100 dark:border-gray-800 p-4 sm:grid-cols-2"
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
                                <Select
                                    value={form.data.ignorePassiveAddress}
                                    onValueChange={(value) =>
                                        form.setData(
                                            'ignorePassiveAddress',
                                            value as IgnorePassiveAddress,
                                        )
                                    }
                                >
                                    <SelectTrigger
                                        id="edit-ftp-ignore-passive-address"
                                        className="w-full"
                                    >
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {booleanOptions.map((option) => (
                                            <SelectItem
                                                key={option.label}
                                                value={option.value}
                                            >
                                                {option.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </Field>

                            <Field
                                label="System type"
                                error={form.errors.systemType}
                            >
                                <Select
                                    value={form.data.systemType}
                                    onValueChange={(value) =>
                                        form.setData(
                                            'systemType',
                                            value as SystemType,
                                        )
                                    }
                                >
                                    <SelectTrigger
                                        id="edit-ftp-system-type"
                                        className="w-full"
                                    >
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {systemTypeOptions.map((option) => (
                                            <SelectItem
                                                key={option.value}
                                                value={option.value}
                                            >
                                                {option.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </Field>

                            <CheckboxField
                                label="UTF-8"
                                checked={form.data.utf8}
                                onChange={(checked) =>
                                    form.setData('utf8', checked)
                                }
                                error={form.errors.utf8}
                                alignWithFields
                            />
                            <CheckboxField
                                label="Recurse manually"
                                checked={form.data.recurseManually}
                                onChange={(checked) =>
                                    form.setData('recurseManually', checked)
                                }
                                error={form.errors.recurseManually}
                                alignWithFields
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
                                alignWithFields
                            />
                        </div>
                    )}
                </div>

                <div className="mt-6 flex justify-end gap-2">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={processing}
                        className="rounded-md border border-gray-200 dark:border-gray-700 px-4 py-2 text-sm font-bold text-gray-600 dark:text-gray-400 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-60"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={processing}
                        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
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
                ? 'default'
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
            data.ignorePassiveAddress === 'default'
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

function CheckboxField({
    label,
    checked,
    onChange,
    error,
    alignWithFields = false,
}: {
    label: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
    error?: string;
    alignWithFields?: boolean;
}) {
    return (
        <div className="space-y-2">
            {alignWithFields && <div className="h-4" aria-hidden="true" />}
            <label className="flex h-10 items-center gap-3 rounded-md border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 text-sm font-bold text-gray-700 dark:text-gray-300">
                <input
                    type="checkbox"
                    checked={checked}
                    onChange={(event) => onChange(event.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                {label}
            </label>
            {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
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
    'h-10 w-full rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 text-sm font-medium text-gray-900 dark:text-gray-100 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/50';
