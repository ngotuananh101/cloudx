export interface ProviderCapabilities {
    browse: boolean;
    upload: boolean;
    download: boolean;
    delete: boolean;
    createFolder: boolean;
    share: boolean;
}

export interface AvailableProvider {
    key: string;
    label: string;
    value: number;
    icon: string;
    status: 'active' | 'disabled' | 'coming-soon';
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
}

export interface CloudFile {
    id: string | number;
    path: string;
    name: string;
    type: 'folder' | 'document' | 'image' | 'code' | 'archive' | 'video' | 'audio' | 'other';
    size: number;
    updatedAt: string;
    isDirectory: boolean;
}
