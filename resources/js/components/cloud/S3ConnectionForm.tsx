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
import { store } from '@/routes/connections/s3';

interface S3ConnectionFormProps {
    onCancel: () => void;
    onSuccess: () => void;
}

type S3ProviderPreset =
    | 'aws'
    | 'minio'
    | 'cloudflare-r2'
    | 'digitalocean-spaces'
    | 'wasabi'
    | 'backblaze-b2'
    | 'hetzner'
    | 'rustfs'
    | 'custom';

interface S3ConnectionFormData {
    name: string;
    provider_preset: S3ProviderPreset;
    bucket: string;
    region: string;
    access_key_id: string;
    secret_access_key: string;
    endpoint: string;
    use_path_style_endpoint: boolean;
    root: string;
    session_token: string;
    cdn_url: string;
}

const providerPresets = [
    { label: 'AWS S3', value: 'aws' },
    { label: 'MinIO', value: 'minio' },
    { label: 'Cloudflare R2', value: 'cloudflare-r2' },
    { label: 'DigitalOcean Spaces', value: 'digitalocean-spaces' },
    { label: 'Wasabi', value: 'wasabi' },
    { label: 'Backblaze B2', value: 'backblaze-b2' },
    { label: 'Hetzner', value: 'hetzner' },
    { label: 'RustFS', value: 'rustfs' },
    { label: 'Custom', value: 'custom' },
] as const;

export default function S3ConnectionForm({
    onCancel,
    onSuccess,
}: Readonly<S3ConnectionFormProps>) {
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [processing, setProcessing] = useState(false);
    const form = useForm<S3ConnectionFormData>({
        name: '',
        provider_preset: 'aws',
        bucket: '',
        region: 'us-east-1',
        access_key_id: '',
        secret_access_key: '',
        endpoint: '',
        use_path_style_endpoint: false,
        root: '',
        session_token: '',
        cdn_url: '',
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
                        id="s3-name"
                        value={form.data.name}
                        onChange={(event) =>
                            form.setData('name', event.target.value)
                        }
                        className={inputClassName}
                        aria-invalid={Boolean(form.errors.name)}
                        autoFocus
                    />
                </Field>

                <Field
                    label="Provider preset"
                    error={form.errors.provider_preset}
                    required
                >
                    <Select
                        value={form.data.provider_preset}
                        onValueChange={(value) =>
                            form.setData(
                                'provider_preset',
                                value as S3ProviderPreset,
                            )
                        }
                    >
                        <SelectTrigger
                            id="s3-provider-preset"
                            className="w-full"
                        >
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {providerPresets.map((option) => (
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

                <Field label="Bucket" error={form.errors.bucket} required>
                    <input
                        id="s3-bucket"
                        value={form.data.bucket}
                        onChange={(event) =>
                            form.setData('bucket', event.target.value)
                        }
                        className={inputClassName}
                        aria-invalid={Boolean(form.errors.bucket)}
                        placeholder="my-bucket"
                    />
                </Field>

                <Field label="Region" error={form.errors.region} required>
                    <input
                        id="s3-region"
                        value={form.data.region}
                        onChange={(event) =>
                            form.setData('region', event.target.value)
                        }
                        className={inputClassName}
                        aria-invalid={Boolean(form.errors.region)}
                        placeholder="us-east-1"
                    />
                </Field>

                <Field
                    label="Access key ID"
                    error={form.errors.access_key_id}
                    required
                >
                    <input
                        id="s3-access-key-id"
                        value={form.data.access_key_id}
                        onChange={(event) =>
                            form.setData('access_key_id', event.target.value)
                        }
                        className={inputClassName}
                        aria-invalid={Boolean(form.errors.access_key_id)}
                    />
                </Field>

                <Field
                    label="Secret access key"
                    error={form.errors.secret_access_key}
                    required
                >
                    <input
                        id="s3-secret-access-key"
                        type="password"
                        value={form.data.secret_access_key}
                        onChange={(event) =>
                            form.setData(
                                'secret_access_key',
                                event.target.value,
                            )
                        }
                        className={inputClassName}
                        aria-invalid={Boolean(form.errors.secret_access_key)}
                    />
                </Field>
            </div>

            <div className="rounded-2xl border border-border bg-muted/50">
                <button
                    type="button"
                    onClick={() => setShowAdvanced((current) => !current)}
                    className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-bold text-foreground"
                    aria-expanded={showAdvanced}
                    aria-controls="s3-advanced-settings"
                >
                    Advanced settings
                    <ChevronDown
                        className={`h-4 w-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`}
                        aria-hidden="true"
                    />
                </button>

                {showAdvanced && (
                    <div
                        id="s3-advanced-settings"
                        className="grid gap-4 border-t border-border p-4 sm:grid-cols-2"
                    >
                        <Field label="Endpoint" error={form.errors.endpoint}>
                            <input
                                id="s3-endpoint"
                                value={form.data.endpoint}
                                onChange={(event) =>
                                    form.setData('endpoint', event.target.value)
                                }
                                className={inputClassName}
                                aria-invalid={Boolean(form.errors.endpoint)}
                                placeholder="https://nyc3.digitaloceanspaces.com"
                            />
                        </Field>

                        <Field label="Root / prefix" error={form.errors.root}>
                            <input
                                id="s3-root"
                                value={form.data.root}
                                onChange={(event) =>
                                    form.setData('root', event.target.value)
                                }
                                className={inputClassName}
                                aria-invalid={Boolean(form.errors.root)}
                                placeholder="uploads"
                            />
                        </Field>

                        <Field
                            label="Session token"
                            error={form.errors.session_token}
                        >
                            <input
                                id="s3-session-token"
                                value={form.data.session_token}
                                onChange={(event) =>
                                    form.setData(
                                        'session_token',
                                        event.target.value,
                                    )
                                }
                                className={inputClassName}
                                aria-invalid={Boolean(
                                    form.errors.session_token,
                                )}
                            />
                        </Field>

                        <Field label="CDN URL" error={form.errors.cdn_url}>
                            <input
                                id="s3-cdn-url"
                                value={form.data.cdn_url}
                                onChange={(event) =>
                                    form.setData('cdn_url', event.target.value)
                                }
                                className={inputClassName}
                                aria-invalid={Boolean(form.errors.cdn_url)}
                                placeholder="https://cdn.example.com"
                            />
                        </Field>

                        <CheckboxField
                            label="Use path-style endpoint"
                            checked={form.data.use_path_style_endpoint}
                            onChange={(checked) =>
                                form.setData('use_path_style_endpoint', checked)
                            }
                            error={form.errors.use_path_style_endpoint}
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
                    {processing ? 'Testing connection...' : 'Connect S3'}
                </button>
            </div>
        </form>
    );
}

function payload(data: Readonly<S3ConnectionFormData>) {
    return {
        ...data,
        endpoint: data.endpoint || null,
        root: data.root || null,
        session_token: data.session_token || null,
        cdn_url: data.cdn_url || null,
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
