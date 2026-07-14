import { router, useForm } from '@inertiajs/react';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { store } from '@/routes/connections/ftp';

interface FtpConnectionFormProps {
    onCancel: () => void;
    onSuccess: () => void;
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

export default function FtpConnectionForm({
    onCancel,
    onSuccess,
}: Readonly<FtpConnectionFormProps>) {
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [processing, setProcessing] = useState(false);
    const form = useForm<FtpConnectionFormData>({
        name: '',
        host: '',
        port: '21',
        username: '',
        password: '',
        root: '',
        ssl: false,
        passive: true,
        timeout: '',
        utf8: false,
        ignorePassiveAddress: 'default',
        systemType: 'auto',
        recurseManually: false,
        timestampsOnUnixListingsEnabled: true,
    });

    const submit = (event: Readonly<FormEvent<HTMLFormElement>>) => {
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
                        id="ftp-name"
                        value={form.data.name}
                        onChange={(event) =>
                            form.setData('name', event.target.value)
                        }
                        className={inputClassName}
                        aria-invalid={Boolean(form.errors.name)}
                        aria-describedby={
                            form.errors.name ? 'ftp-name-error' : undefined
                        }
                        autoFocus
                    />
                </Field>

                <Field label="Host" error={form.errors.host} required>
                    <input
                        id="ftp-host"
                        value={form.data.host}
                        onChange={(event) =>
                            form.setData('host', event.target.value)
                        }
                        className={inputClassName}
                        aria-invalid={Boolean(form.errors.host)}
                        aria-describedby={
                            form.errors.host ? 'ftp-host-error' : undefined
                        }
                        placeholder="ftp.example.com"
                    />
                </Field>

                <Field label="Port" error={form.errors.port} required>
                    <input
                        id="ftp-port"
                        type="number"
                        min="1"
                        max="65535"
                        value={form.data.port}
                        onChange={(event) =>
                            form.setData('port', event.target.value)
                        }
                        className={inputClassName}
                        aria-invalid={Boolean(form.errors.port)}
                        aria-describedby={
                            form.errors.port ? 'ftp-port-error' : undefined
                        }
                    />
                </Field>

                <Field label="Username" error={form.errors.username} required>
                    <input
                        id="ftp-username"
                        value={form.data.username}
                        onChange={(event) =>
                            form.setData('username', event.target.value)
                        }
                        className={inputClassName}
                        aria-invalid={Boolean(form.errors.username)}
                        aria-describedby={
                            form.errors.username
                                ? 'ftp-username-error'
                                : undefined
                        }
                    />
                </Field>

                <Field label="Password" error={form.errors.password} required>
                    <input
                        id="ftp-password"
                        type="password"
                        value={form.data.password}
                        onChange={(event) =>
                            form.setData('password', event.target.value)
                        }
                        className={inputClassName}
                        aria-invalid={Boolean(form.errors.password)}
                        aria-describedby={
                            form.errors.password
                                ? 'ftp-password-error'
                                : undefined
                        }
                    />
                </Field>

                <Field label="Root" error={form.errors.root}>
                    <input
                        id="ftp-root"
                        value={form.data.root}
                        onChange={(event) =>
                            form.setData('root', event.target.value)
                        }
                        className={inputClassName}
                        aria-invalid={Boolean(form.errors.root)}
                        aria-describedby={
                            form.errors.root ? 'ftp-root-error' : undefined
                        }
                        placeholder="/"
                    />
                </Field>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
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

            <div className="rounded-2xl border border-border bg-muted/50">
                <button
                    type="button"
                    onClick={() => setShowAdvanced((current) => !current)}
                    className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-bold text-foreground"
                    aria-expanded={showAdvanced}
                    aria-controls="ftp-advanced-settings"
                >
                    Advanced settings
                    <ChevronDown
                        className={`h-4 w-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`}
                        aria-hidden="true"
                    />
                </button>

                {showAdvanced && (
                    <div
                        id="ftp-advanced-settings"
                        className="grid gap-4 border-t border-border p-4 sm:grid-cols-2"
                    >
                        <Field label="Timeout" error={form.errors.timeout}>
                            <input
                                id="ftp-timeout"
                                type="number"
                                min="1"
                                max="300"
                                value={form.data.timeout}
                                onChange={(event) =>
                                    form.setData('timeout', event.target.value)
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
                                    id="ftp-ignore-passive-address"
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
                                    id="ftp-system-type"
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
                            checked={form.data.timestampsOnUnixListingsEnabled}
                            onChange={(checked) =>
                                form.setData(
                                    'timestampsOnUnixListingsEnabled',
                                    checked,
                                )
                            }
                            error={form.errors.timestampsOnUnixListingsEnabled}
                            alignWithFields
                        />
                    </div>
                )}
            </div>

            <div className="flex justify-end gap-2">
                <button
                    type="button"
                    onClick={onCancel}
                    disabled={processing}
                    className="rounded-md border border-border px-4 py-2 text-sm font-bold text-foreground transition-colors hover:bg-muted hover:bg-muted/70 disabled:opacity-60"
                >
                    Back
                </button>
                <button
                    type="submit"
                    disabled={processing}
                    className="rounded-md bg-primary px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-primary/90 disabled:opacity-60"
                >
                    {processing ? 'Testing connection...' : 'Connect FTP'}
                </button>
            </div>
        </form>
    );
}

function payload(data: Readonly<FtpConnectionFormData>) {
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

function CheckboxField({
    label,
    checked,
    onChange,
    error,
    alignWithFields = false,
}: Readonly<{
    label: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
    error?: string;
    alignWithFields?: boolean;
}>) {
    return (
        <div className="space-y-2">
            {alignWithFields && <div className="h-4" aria-hidden="true" />}
            <label className="flex h-10 items-center gap-3 rounded-md border border-border bg-card px-3 text-sm font-bold text-foreground">
                <input
                    type="checkbox"
                    checked={checked}
                    onChange={(event) => onChange(event.target.checked)}
                    className="h-4 w-4 rounded border-input text-primary focus:ring-ring"
                />
                {label}
            </label>
            {error && <p className="text-xs text-destructive">{error}</p>}
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
