import { X } from 'lucide-react';
import { useState } from 'react';
import FtpConnectionForm from '@/components/cloud/FtpConnectionForm';
import SftpConnectionForm from '@/components/cloud/SftpConnectionForm';
import TelegramConnectionForm from '@/components/cloud/TelegramConnectionForm';
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
    const isSftpSelected = selectedCredentialsProvider?.key === 'sftp';
    const isTelegramSelected = selectedCredentialsProvider?.key === 'telegram';
    const isCredentialsSelected =
        isFtpSelected || isSftpSelected || isTelegramSelected;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 p-4 backdrop-blur-sm">
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="connect-storage-modal-title"
                className={`relative w-full overflow-hidden rounded-3xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-2xl transition-all ${isCredentialsSelected ? 'max-w-2xl' : 'max-w-md'}`}
            >
                <button
                    type="button"
                    onClick={onClose}
                    className="absolute top-4 right-4 rounded-xl p-2 text-gray-400 dark:text-gray-500 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-300"
                    aria-label="Close connect storage modal"
                >
                    <X className="h-5 w-5" aria-hidden="true" />
                </button>

                <div className="mb-6">
                    <h3
                        id="connect-storage-modal-title"
                        className="text-xl font-extrabold tracking-tight text-gray-900 dark:text-gray-100"
                    >
                        {isFtpSelected && 'Connect FTP'}
                        {isSftpSelected && 'Connect SFTP'}
                        {isTelegramSelected && 'Connect Telegram'}
                        {!isCredentialsSelected && 'Connect Storage'}
                    </h3>
                    <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                        {isFtpSelected && 'Enter your FTP server credentials to test and link the connection'}
                        {isSftpSelected && 'Enter your SFTP server credentials to test and link the connection'}
                        {isTelegramSelected && 'Connect your Telegram account to store files in Saved Messages'}
                        {!isCredentialsSelected && 'Select a cloud storage provider to link your account'}
                    </p>
                </div>

                {isFtpSelected && (
                    <FtpConnectionForm
                        onCancel={() => setSelectedCredentialsProvider(null)}
                        onSuccess={onClose}
                    />
                )}

                {isSftpSelected && (
                    <SftpConnectionForm
                        onCancel={() => setSelectedCredentialsProvider(null)}
                        onSuccess={onClose}
                    />
                )}

                {isTelegramSelected && (
                    <TelegramConnectionForm
                        onCancel={() => setSelectedCredentialsProvider(null)}
                        onSuccess={onClose}
                    />
                )}

                {!isCredentialsSelected && (
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
