export interface ActivityLogAction {
    value: number;
    key: string;
    label: string;
    icon: string;
}

export interface ActivityLogConnection {
    id: number;
    name: string;
}

export interface ActivityLogEntry {
    id: number;
    action: ActivityLogAction;
    subject_name: string;
    source_name: string | null;
    target_name: string | null;
    connection: ActivityLogConnection | null;
    created_at: string | null;
}
