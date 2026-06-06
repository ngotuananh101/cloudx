import { ChevronRight, Cloud, Lock } from 'lucide-react';
import type { AvailableProvider } from '@/types/cloud';

interface ProviderOptionProps {
    provider: AvailableProvider;
    onSelectCredentialsProvider: (provider: AvailableProvider) => void;
}

function isSvgIcon(icon: string | null | undefined): icon is string {
    return Boolean(icon?.endsWith('.svg'));
}

export default function ProviderOption({
    provider,
    onSelectCredentialsProvider,
}: ProviderOptionProps) {
    const isSupportedCredentialsProvider =
        provider.authType === 'credentials' &&
        (provider.key === 'ftp' ||
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
            <div className="flex w-full items-center justify-between rounded-2xl border border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50 p-4 text-left opacity-75 select-none">
                <div className="flex items-center gap-4">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gray-500/5 dark:bg-gray-500/10 text-gray-400 dark:text-gray-500">
                        {icon}
                    </div>
                    <div>
                        <h5 className="text-sm font-bold text-gray-500 dark:text-gray-400">
                            {provider.label}
                        </h5>
                        <span className="mt-1 inline-block rounded-full bg-gray-100 dark:bg-gray-800 px-2 py-0.5 text-[10px] font-bold text-gray-400 dark:text-gray-500">
                            Coming Soon
                        </span>
                    </div>
                </div>
                <Lock
                    className="mr-1 h-4 w-4 text-gray-300 dark:text-gray-600"
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
                    window.location.href = provider.redirectUrl;
                }
            }}
            className="group flex w-full items-center justify-between rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 text-left shadow-sm transition-all duration-300 hover:border-blue-200 dark:hover:border-blue-800/50 hover:bg-blue-50/20 dark:hover:bg-blue-900/20"
        >
            <div className="flex items-center gap-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500/10">
                    {icon}
                </div>
                <div>
                    <h5 className="text-sm font-bold text-gray-900 dark:text-gray-100">
                        {provider.label}
                    </h5>
                    <span className="mt-1 inline-block rounded-full bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                        Active
                    </span>
                </div>
            </div>
            <ChevronRight
                className="h-5 w-5 text-gray-400 dark:text-gray-500 transition-all group-hover:translate-x-1 group-hover:text-blue-600 dark:group-hover:text-blue-400"
                aria-hidden="true"
            />
        </button>
    );
}
