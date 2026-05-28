import { X } from 'lucide-react';
import ProviderOption from '@/components/cloud/ProviderOption';
import type { AvailableProvider } from '@/types/cloud';

interface ConnectStorageModalProps {
    providers: AvailableProvider[];
    onClose: () => void;
}

export default function ConnectStorageModal({
    providers,
    onClose,
}: ConnectStorageModalProps) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 p-4 backdrop-blur-sm">
            <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-gray-100 bg-white p-6 shadow-2xl transition-all">
                <button
                    type="button"
                    onClick={onClose}
                    className="absolute top-4 right-4 rounded-xl p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
                    aria-label="Close connect storage modal"
                >
                    <X className="h-5 w-5" aria-hidden="true" />
                </button>

                <div className="mb-6">
                    <h3 className="text-xl font-extrabold tracking-tight text-gray-900">
                        Connect Storage
                    </h3>
                    <p className="mt-1 text-xs font-medium text-gray-400">
                        Select a cloud storage provider to link your account
                    </p>
                </div>

                <div className="space-y-3">
                    {providers.map((provider) => (
                        <ProviderOption
                            key={provider.key}
                            provider={provider}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}
