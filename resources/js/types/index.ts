import type { User } from './auth';
import type { CloudConnection } from './cloud';

export type * from './auth';

export type PageProps<
    T extends Record<string, unknown> = Record<string, unknown>,
> = T & {
    auth: {
        user: User | null;
    };
    name?: string;
    connection?: CloudConnection;
    [key: string]: unknown;
};
