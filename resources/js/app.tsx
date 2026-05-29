import { createInertiaApp } from '@inertiajs/react';
import { configureEcho } from '@laravel/echo-react';
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { UploadManagerProvider } from '@/contexts/UploadManagerContext';

configureEcho({
    broadcaster: 'reverb',
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
            createElement(App, {
                ...props,
                children: ({ Component, props: pageProps, key }) =>
                    createElement(
                        UploadManagerProvider,
                        null,
                        createElement(Component, { ...pageProps, key }),
                    ),
            }),
        );
    },
});
