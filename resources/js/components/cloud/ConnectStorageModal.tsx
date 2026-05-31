import { X } from 'lucide-react';
import { useState } from 'react';
import FtpConnectionForm from '@/components/cloud/FtpConnectionForm';
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
    const [selectedCredentialsProvider, setSelectedCredentialsProvider] =
        useState<AvailableProvider | null>(null);

    const isFtpSelected = selectedCredentialsProvider?.key === 'ftp';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 p-4 backdrop-blur-sm">
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="connect-storage-modal-title"
                className={`relative w-full overflow-hidden rounded-3xl border border-gray-100 bg-white p-6 shadow-2xl transition-all ${isFtpSelected ? 'max-w-2xl' : 'max-w-md'}`}
            >
                <button
                    type="button"
                    onClick={onClose}
                    className="absolute top-4 right-4 rounded-xl p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
                    aria-label="Close connect storage modal"
                >
                    <X className="h-5 w-5" aria-hidden="true" />
                </button>

                <div className="mb-6">
                    <h3
                        id="connect-storage-modal-title"
                        className="text-xl font-extrabold tracking-tight text-gray-900"
                    >
                        {isFtpSelected ? 'Connect FTP' : 'Connect Storage'}
                    </h3>
                    <p className="mt-1 text-xs font-medium text-gray-400">
                        {isFtpSelected
                            ? 'Enter your FTP server credentials to test and link the connection'
                            : 'Select a cloud storage provider to link your account'}
                    </p>
                </div>

                {isFtpSelected ? (
                    <FtpConnectionForm
                        onCancel={() => setSelectedCredentialsProvider(null)}
                        onSuccess={onClose}
                    />
                ) : (
                    <div className="space-y-3">
                        {providers.map((provider) => (
                            <ProviderOption
                                key={provider.key}
                                provider={provider}
                                onSelectCredentialsProvider={
                                    setSelectedCredentialsProvider
                                }
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
