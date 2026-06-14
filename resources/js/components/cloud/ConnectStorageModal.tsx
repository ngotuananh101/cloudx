import { useState } from 'react';
import FtpConnectionForm from '@/components/cloud/FtpConnectionForm';
import ProviderOption from '@/components/cloud/ProviderOption';
import S3ConnectionForm from '@/components/cloud/S3ConnectionForm';
import SftpConnectionForm from '@/components/cloud/SftpConnectionForm';
import TelegramConnectionForm from '@/components/cloud/TelegramConnectionForm';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
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
    const isS3Selected = selectedCredentialsProvider?.key === 'aws-s3';
    const isSftpSelected = selectedCredentialsProvider?.key === 'sftp';
    const isTelegramSelected = selectedCredentialsProvider?.key === 'telegram';
    const isCredentialsSelected =
        isFtpSelected || isS3Selected || isSftpSelected || isTelegramSelected;

    return (
        <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className={`w-full overflow-hidden rounded-3xl border border-border bg-card p-6 shadow-2xl transition-all [&>button]:right-6 [&>button]:top-6 [&>button]:z-10 ${isCredentialsSelected ? 'sm:max-w-2xl' : 'sm:max-w-md xl:max-w-2xl'}`}>
                <div className="mb-6">
                    <DialogHeader className="text-left">
                        <DialogTitle className="text-xl font-extrabold tracking-tight text-foreground">
                            {isFtpSelected && 'Connect FTP'}
                            {isS3Selected && 'Connect S3'}
                            {isSftpSelected && 'Connect SFTP'}
                            {isTelegramSelected && 'Connect Telegram'}
                            {!isCredentialsSelected && 'Connect Storage'}
                        </DialogTitle>
                        <DialogDescription className="mt-1 text-xs text-muted-foreground">
                            {isFtpSelected && 'Enter your FTP server credentials to test and link the connection'}
                            {isS3Selected && 'Enter your S3 or S3-compatible storage credentials to test and link the connection'}
                            {isSftpSelected && 'Enter your SFTP server credentials to test and link the connection'}
                            {isTelegramSelected && 'Connect your Telegram account to store files in Saved Messages'}
                            {!isCredentialsSelected && 'Select a cloud storage provider to link your account'}
                        </DialogDescription>
                    </DialogHeader>
                </div>

                {isFtpSelected && (
                    <FtpConnectionForm
                        onCancel={() => setSelectedCredentialsProvider(null)}
                        onSuccess={onClose}
                    />
                )}

                {isS3Selected && (
                    <S3ConnectionForm
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
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto pr-2 content-start">
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
            </DialogContent>
        </Dialog>
    );
}
