import { createInertiaApp } from '@inertiajs/react';
import { configureEcho } from '@laravel/echo-react';
import { createRoot } from 'react-dom/client';

import { ThemeProvider } from '@/components/ThemeProvider';
import { Toaster } from '@/components/ui/sonner';
import { UploadManagerProvider } from '@/contexts/UploadManagerContext';

configureEcho({
    broadcaster: 'pusher',
    key: import.meta.env.VITE_PUSHER_APP_KEY,
    cluster: import.meta.env.VITE_PUSHER_APP_CLUSTER ?? 'ap1',
    wsHost: import.meta.env.VITE_PUSHER_HOST
        ? import.meta.env.VITE_PUSHER_HOST
        : undefined,
    wsPort: import.meta.env.VITE_PUSHER_PORT
        ? Number(import.meta.env.VITE_PUSHER_PORT)
        : undefined,
    wssPort: import.meta.env.VITE_PUSHER_PORT
        ? Number(import.meta.env.VITE_PUSHER_PORT)
        : undefined,
    forceTLS: (import.meta.env.VITE_PUSHER_SCHEME ?? 'https') === 'https',
    enabledTransports: ['ws', 'wss'],
});

const appName = import.meta.env.VITE_APP_NAME || 'Laravel';

createInertiaApp({
    title: (title) => (title ? `${title} - ${appName}` : appName),
    progress: {
        // Inertia progress.color is resolved at JS init time before CSS
        // variables are guaranteed to be readable, so we mirror the value of
        // --primary (light theme) from resources/css/app.css here.
        // To rebrand, change --primary in app.css and update this string.
        color: 'oklch(0.514 0.222 16.935)',
    },
    setup: ({ el, App, props }) => {
        if (!el) {
            return;
        }

        createRoot(el).render(
            <ThemeProvider defaultTheme="system" storageKey="cloudx-ui-theme">
                <App {...props}>
                    {({ Component, props: pageProps, key }) => (
                        <UploadManagerProvider>
                            <Component {...pageProps} key={key} />
                        </UploadManagerProvider>
                    )}
                </App>
                <Toaster position="top-right" />
            </ThemeProvider>,
        );
    },
});
