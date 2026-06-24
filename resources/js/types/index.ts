export type * from './auth';

export type PageProps<
    T extends Record<string, unknown> = Record<string, unknown>,
> = T & {
    auth: {
        user: import('./auth').User | null;
    };
    name?: string;
    connection?: import('./cloud').CloudConnection;
    [key: string]: unknown;
};
