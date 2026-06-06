import { createInertiaApp } from '@inertiajs/react';
import { configureEcho } from '@laravel/echo-react';
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { UploadManagerProvider } from '@/contexts/UploadManagerContext';

import { ThemeProvider } from '@/components/ThemeProvider';

configureEcho({
    broadcaster: 'pusher',
});

const appName = import.meta.env.VITE_APP_NAME || 'Laravel';

createInertiaApp({
    title: (title) => (title ? `${title} - ${appName}` : appName),
    progress: {
        color: '#bd1e24',
    },
    setup: ({ el, App, props }) => {
        if (!el) {
            return;
        }

        createRoot(el).render(
            <ThemeProvider defaultTheme="system" storageKey="cloudx-ui-theme">
                <App
                    {...props}
                    children={({ Component, props: pageProps, key }) => (
                        <UploadManagerProvider>
                            <Component {...pageProps} key={key} />
                        </UploadManagerProvider>
                    )}
                />
            </ThemeProvider>
        );
    },
});
