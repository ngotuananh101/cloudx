import { ChevronRight, Cloud, Lock } from 'lucide-react';
import type { AvailableProvider } from '@/types/cloud';

interface ProviderOptionProps {
    provider: AvailableProvider;
    onSelectCredentialsProvider: (provider: Readonly<AvailableProvider>) => void;
}

function isSvgIcon(icon: string | null | undefined): icon is string {
    return Boolean(icon?.endsWith('.svg'));
}

export default function ProviderOption({
    provider,
    onSelectCredentialsProvider,
}: Readonly<ProviderOptionProps>) {
    const isSupportedCredentialsProvider =
        provider.authType === 'credentials' &&
        (provider.key === 'ftp' ||
            provider.key === 'aws-s3' ||
            provider.key === 'sftp' ||
            provider.key === 'telegram');
    const isActive =
        provider.status === 'active' &&
        (isSupportedCredentialsProvider || Boolean(provider.redirectUrl));

    const icon = isSvgIcon(provider.icon) ? (
        <img
            src={provider.icon}
            className="h-6 w-6"
            alt={`${provider.label} icon`}
        />
    ) : (
        <Cloud className="h-6 w-6" aria-hidden="true" />
    );

    if (!isActive) {
        return (
            <div className="flex w-full items-center justify-between rounded-2xl border border-border bg-muted/50 p-4 text-left opacity-75 select-none">
                <div className="flex items-center gap-4">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                        {icon}
                    </div>
                    <div>
                        <h5 className="text-sm font-bold text-muted-foreground">
                            {provider.label}
                        </h5>
                        <span className="mt-1 inline-block rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                            Coming Soon
                        </span>
                    </div>
                </div>
                <Lock
                    className="mr-1 h-4 w-4 text-muted-foreground/50"
                    aria-hidden="true"
                />
            </div>
        );
    }

    return (
        <button
            type="button"
            onClick={() => {
                if (isSupportedCredentialsProvider) {
                    onSelectCredentialsProvider(provider);

                    return;
                }

                if (provider.redirectUrl) {
                    globalThis.location.href = provider.redirectUrl;
                }
            }}
            className="group flex w-full items-center justify-between rounded-2xl border border-border bg-card p-4 text-left shadow-sm transition-all duration-300 hover:border-primary/50 hover:bg-primary/5"
        >
            <div className="flex items-center gap-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
                    {icon}
                </div>
                <div>
                    <h5 className="text-sm font-bold text-foreground">
                        {provider.label}
                    </h5>
                    <span className="mt-1 inline-block rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                        Active
                    </span>
                </div>
            </div>
            <ChevronRight
                className="h-5 w-5 text-muted-foreground transition-all group-hover:translate-x-1 group-hover:text-primary"
                aria-hidden="true"
            />
        </button>
    );
}
