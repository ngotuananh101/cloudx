import { xsrfToken } from '@/lib/csrf';

export const requestJson = async <T>(
    url: string,
    options: RequestInit = {},
): Promise<T> => {
    const response = await fetch(url, {
        ...options,
        headers: {
            Accept: 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
            'X-XSRF-TOKEN': xsrfToken(),
            ...options.headers,
        },
    });

    if (!response.ok) {
        const payload = await response.json().catch(() => null);

        throw new Error(payload?.message || 'Request failed.');
    }

    return response.json();
};
