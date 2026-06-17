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
}
