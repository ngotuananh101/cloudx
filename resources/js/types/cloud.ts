export interface ProviderCapabilities {
    browse: boolean;
    upload: boolean;
    download: boolean;
    delete: boolean;
    createFolder: boolean;
    share: boolean;
    move: boolean;
}

export interface AvailableProvider {
    key: string;
    label: string;
    value: number;
    icon: string;
    status: 'active' | 'disabled' | 'coming-soon';
    authType: 'oauth' | 'credentials';
    redirectUrl: string | null;
    capabilities: ProviderCapabilities;
}

export interface CloudStorageQuota {
    totalBytes: number | null;
    usedBytes: number | null;
    remainingBytes: number | null;
    usedPercent: number | null;
    supported: boolean;
}

export interface CloudConnectionActions {
    canReconnect: boolean;
    canEditName: boolean;
    canEditConnection: boolean;
    canDelete: boolean;
}

export interface FtpConnectionConfig {
    host?: string;
    port?: number;
    username?: string;
    root?: string;
    ssl?: boolean;
    passive?: boolean;
    timeout?: number;
    utf8?: boolean;
    ignore_passive_address?: boolean;
    system_type?: 'unix' | 'windows' | null;
    recurse_manually?: boolean;
    timestamps_on_unix_listings_enabled?: boolean;
}

export interface S3ConnectionConfig {
    provider_preset?: string;
    access_key_id?: string;
    region?: string;
    bucket?: string;
    endpoint?: string | null;
    use_path_style_endpoint?: boolean;
    root?: string;
    cdn_url?: string | null;
}

export interface SftpConnectionConfig {
    host?: string;
    port?: number;
    username?: string;
    root?: string;
    hostFingerprint?: string;
    timeout?: number;
    maxTries?: number;
}

export interface TelegramConnectionConfig {
    session_id?: string;
}

export interface CloudConnection {
    id: number;
    name: string;
    provider: string;
    provider_label?: string;
    provider_value?: number;
    provider_icon?: string;
    status?: string;
    status_value?: number;
    used_space?: number;
    total_space?: number;
    used_formatted?: string;
    total_formatted?: string;
    percent?: number;
    storageQuota?: CloudStorageQuota;
    capabilities?: ProviderCapabilities;
    actions?: CloudConnectionActions;
    ftp_config?: FtpConnectionConfig;
    s3_config?: S3ConnectionConfig;
    sftp_config?: SftpConnectionConfig;
    telegram_config?: TelegramConnectionConfig;
}

export type UploadMode = 'backend' | 'direct';

export type UploadTaskStatus =
    | 'pending'
    | 'uploading'
    | 'paused'
    | 'queued'
    | 'processing'
    | 'completed'
    | 'failed'
    | 'cancelled';

export interface CloudUploadTaskPayload {
    filename: string;
    mime_type: string | null;
    size: number;
    chunk_size: number;
    total_chunks: number;
    uploaded_chunks_count: number;
    upload_mode?: UploadMode;
    s3_multipart?: {
        upload_id: string;
        key: string;
        parts: Array<{ ETag: string; PartNumber: number }>;
    };
    last_broadcast_progress?: number;
}

export interface CloudUploadTask {
    id: number;
    connection_id: number;
    name: string;
    type: string;
    status: UploadTaskStatus;
    status_value: number;
    target_path: string;
    payload: CloudUploadTaskPayload;
    progress: number;
    uploaded_chunks_count: number;
    total_chunks: number;
    result: { path?: string } | null;
    error_message: string | null;
    uploaded_chunks: number[];
    updated_at: string | null;
}

export interface UploadQueueItem {
    key: string;
    file: File;
    connectionId: number;
    path: string;
    uploadMode?: UploadMode;
    task?: CloudUploadTask;
    progress: number;
    status: UploadTaskStatus;
    error?: string;
}
