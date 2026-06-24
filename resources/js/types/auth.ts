export type User = {
    id: number;
    name: string;
    email: string;
    avatar?: string;
    email_verified_at: string | null;
    created_at: string;
    updated_at: string;
    connections?: import('./cloud').CloudConnection[];
    [key: string]: unknown; // This allows for additional properties...
};

export type Auth = {
    user: User;
};
