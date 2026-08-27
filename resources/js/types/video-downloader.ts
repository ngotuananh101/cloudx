export interface VideoFormat {
    format_id: string;
    ext: string;
    resolution: string;
    filesize: number | null;
    vcodec: string | null;
    acodec: string | null;
    tbr: number | null;
    format_note: string | null;
}

export interface VideoMetadata {
    title: string;
    duration: number;
    thumbnail: string;
    uploader: string;
    view_count: number;
    description: string;
    webpage_url: string;
    formats: VideoFormat[];
    cookies_warning?: string | null;
}

export interface SavedCookie {
    id: number;
    label: string;
    created_at: string;
}

export interface SavedCookieDetail extends SavedCookie {
    cookies: string;
}
