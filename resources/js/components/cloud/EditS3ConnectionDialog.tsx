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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { update } from '@/routes/connections/s3';
import type { CloudConnection, S3ConnectionConfig } from '@/types/cloud';

interface EditS3ConnectionDialogProps {
    connection: CloudConnection | null;
    onClose: () => void;
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

export default function EditS3ConnectionDialog({
    connection,
    onClose,
}: EditS3ConnectionDialogProps) {
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [processing, setProcessing] = useState(false);
    const form = useForm<S3ConnectionFormData>(initialData(connection));

    useEffect(() => {
        form.setData(initialData(connection));
        form.clearErrors();
        setShowAdvanced(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [connection?.id]);

    if (!connection) {
        return null;
    }

    const submit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        router.patch(update.url({ connection: connection.id }), payload(form.data), {
            preserveScroll: true,
            onBefore: () => {
                form.clearErrors();
                setProcessing(true);
            },
            onError: (errors) => form.setError(errors),
            onFinish: () => setProcessing(false),
            onSuccess: onClose,
        });
    };

    return (
        <Dialog open={connection !== null} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-h-[90vh] sm:max-w-2xl overflow-y-auto rounded-3xl p-0 shadow-2xl bg-card border-border [&>button]:right-6 [&>button]:top-6 [&>button]:z-10">
                <form onSubmit={submit} className="p-6">
                    <DialogHeader className="mb-5 text-left">
                        <DialogTitle className="text-lg font-extrabold tracking-tight text-foreground">
                            Edit S3 connection
                        </DialogTitle>
                        <DialogDescription className="mt-1 text-xs text-muted-foreground">
                            Update storage settings. Leave secret access key blank to keep the current value.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <Field label="Name" error={form.errors.name} required>
                            <input id="edit-s3-name" value={form.data.name} onChange={(event) => form.setData('name', event.target.value)} className={inputClassName} autoFocus />
                        </Field>

                        <Field label="Provider preset" error={form.errors.provider_preset} required>
                            <Select value={form.data.provider_preset} onValueChange={(value) => form.setData('provider_preset', value as S3ProviderPreset)}>
                                <SelectTrigger id="edit-s3-provider-preset" className="w-full">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {providerPresets.map((option) => (
                                        <SelectItem key={option.value} value={option.value}>
                                            {option.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </Field>

                        <Field label="Bucket" error={form.errors.bucket} required>
                            <input id="edit-s3-bucket" value={form.data.bucket} onChange={(event) => form.setData('bucket', event.target.value)} className={inputClassName} />
                        </Field>

                        <Field label="Region" error={form.errors.region} required>
                            <input id="edit-s3-region" value={form.data.region} onChange={(event) => form.setData('region', event.target.value)} className={inputClassName} />
                        </Field>

                        <Field label="Access key ID" error={form.errors.access_key_id} required>
                            <input id="edit-s3-access-key-id" value={form.data.access_key_id} onChange={(event) => form.setData('access_key_id', event.target.value)} className={inputClassName} />
                        </Field>

                        <Field label="Secret access key" error={form.errors.secret_access_key}>
                            <input id="edit-s3-secret-access-key" type="password" value={form.data.secret_access_key} onChange={(event) => form.setData('secret_access_key', event.target.value)} className={inputClassName} placeholder="Leave blank to keep current secret" />
                        </Field>
                    </div>

                    <div className="mt-5 rounded-2xl border border-border bg-muted/50">
                        <button
                            type="button"
                            onClick={() => setShowAdvanced((current) => !current)}
                            className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-bold text-foreground"
                            aria-expanded={showAdvanced}
                            aria-controls="edit-s3-advanced-settings"
                        >
                            Advanced settings
                            <ChevronDown className={`h-4 w-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
                        </button>

                        {showAdvanced && (
                            <div id="edit-s3-advanced-settings" className="grid gap-4 border-t border-border p-4 sm:grid-cols-2">
                                <Field label="Endpoint" error={form.errors.endpoint}>
                                    <input id="edit-s3-endpoint" value={form.data.endpoint} onChange={(event) => form.setData('endpoint', event.target.value)} className={inputClassName} />
                                </Field>
                                <Field label="Root / prefix" error={form.errors.root}>
                                    <input id="edit-s3-root" value={form.data.root} onChange={(event) => form.setData('root', event.target.value)} className={inputClassName} />
                                </Field>
                                <Field label="Session token" error={form.errors.session_token}>
                                    <input id="edit-s3-session-token" value={form.data.session_token} onChange={(event) => form.setData('session_token', event.target.value)} className={inputClassName} />
                                </Field>
                                <Field label="CDN URL" error={form.errors.cdn_url}>
                                    <input id="edit-s3-cdn-url" value={form.data.cdn_url} onChange={(event) => form.setData('cdn_url', event.target.value)} className={inputClassName} />
                                </Field>
                                <CheckboxField
                                    label="Use path-style endpoint"
                                    checked={form.data.use_path_style_endpoint}
                                    onChange={(checked) => form.setData('use_path_style_endpoint', checked)}
                                    error={form.errors.use_path_style_endpoint}
                                    alignWithFields
                                />
                            </div>
                        )}
                    </div>

                    <div className="mt-6 flex justify-end gap-2">
                        <button type="button" onClick={onClose} disabled={processing} className="rounded-md border border-border px-4 py-2 text-sm font-bold text-foreground transition-colors hover:bg-muted hover:bg-muted/70 disabled:opacity-60">Cancel</button>
                        <button type="submit" disabled={processing} className="rounded-md bg-primary px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-primary/90 disabled:opacity-60">{processing ? 'Testing connection...' : 'Save changes'}</button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function initialData(connection: CloudConnection | null): S3ConnectionFormData {
    const config = connection?.s3_config;

    return {
        name: connection?.name ?? '',
        provider_preset: (config?.provider_preset as S3ProviderPreset | undefined) ?? 'aws',
        bucket: config?.bucket ?? '',
        region: config?.region ?? 'us-east-1',
        access_key_id: config?.access_key_id ?? '',
        secret_access_key: '',
        endpoint: config?.endpoint ?? '',
        use_path_style_endpoint: config?.use_path_style_endpoint ?? false,
        root: config?.root ?? '',
        session_token: '',
        cdn_url: config?.cdn_url ?? '',
    };
}

function payload(data: S3ConnectionFormData) {
    return {
        ...data,
        endpoint: data.endpoint || null,
        root: data.root || null,
        session_token: data.session_token || null,
        cdn_url: data.cdn_url || null,
    };
}

function Field({ label, error, required = false, children }: { label: string; error?: string; required?: boolean; children: React.ReactNode; }) {
    const id = getChildId(children);

    return (
        <div className="space-y-2">
            <label htmlFor={id} className="text-xs font-bold text-foreground">
                {label}
                {required && <span className="text-destructive"> *</span>}
            </label>
            {children}
            {error && <p id={id ? `${id}-error` : undefined} className="text-xs text-destructive">{error}</p>}
        </div>
    );
}

function CheckboxField({ label, checked, onChange, error, alignWithFields = false }: { label: string; checked: boolean; onChange: (checked: boolean) => void; error?: string; alignWithFields?: boolean; }) {
    return (
        <div className="space-y-2">
            {alignWithFields && <div className="h-4" aria-hidden="true" />}
            <label className="flex h-10 items-center gap-3 rounded-md border border-border bg-card px-3 text-sm font-bold text-foreground">
                <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4 rounded border-input text-primary focus:ring-ring" />
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
