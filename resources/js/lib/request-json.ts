const csrfToken = () => {
    const cookie = document.cookie
        .split('; ')
        .find((row) => row.startsWith('XSRF-TOKEN='))
        ?.split('=')[1];

    return cookie ? decodeURIComponent(cookie) : '';
};

export const requestJson = async <T>(
    url: string,
    options: RequestInit = {},
): Promise<T> => {
    const response = await fetch(url, {
        ...options,
        headers: {
            Accept: 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
            'X-XSRF-TOKEN': csrfToken(),
            ...(options.headers || {}),
        },
    });

    if (!response.ok) {
        const payload = await response.json().catch(() => null);

        throw new Error(payload?.message || 'Request failed.');
    }

    return response.json();
};
