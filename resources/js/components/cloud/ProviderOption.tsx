import { ChevronRight, Cloud, Lock } from 'lucide-react';
import type { AvailableProvider } from '@/types/cloud';

interface ProviderOptionProps {
    provider: AvailableProvider;
}

function isSvgIcon(icon: string | null | undefined): icon is string {
    return Boolean(icon?.endsWith('.svg'));
}

export default function ProviderOption({ provider }: ProviderOptionProps) {
    const isActive =
        provider.status === 'active' && Boolean(provider.redirectUrl);

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
            <div className="flex w-full items-center justify-between rounded-2xl border border-gray-100 bg-gray-50/50 p-4 text-left opacity-75 select-none">
                <div className="flex items-center gap-4">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gray-500/5 text-gray-400">
                        {icon}
                    </div>
                    <div>
                        <h5 className="text-sm font-bold text-gray-500">
                            {provider.label}
                        </h5>
                        <span className="mt-1 inline-block rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-400">
                            Coming Soon
                        </span>
                    </div>
                </div>
                <Lock
                    className="mr-1 h-4 w-4 text-gray-300"
                    aria-hidden="true"
                />
            </div>
        );
    }

    return (
        <button
            type="button"
            onClick={() => {
                window.location.href = provider.redirectUrl as string;
            }}
            className="group flex w-full items-center justify-between rounded-2xl border border-gray-100 bg-white p-4 text-left shadow-sm transition-all duration-300 hover:border-blue-200 hover:bg-blue-50/20"
        >
            <div className="flex items-center gap-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500/10">
                    {icon}
                </div>
                <div>
                    <h5 className="text-sm font-bold text-gray-900">
                        {provider.label}
                    </h5>
                    <span className="mt-1 inline-block rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-600">
                        Active
                    </span>
                </div>
            </div>
            <ChevronRight
                className="h-5 w-5 text-gray-400 transition-all group-hover:translate-x-1 group-hover:text-blue-600"
                aria-hidden="true"
            />
        </button>
    );
}
