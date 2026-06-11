import { Head } from '@inertiajs/react';
import { Clock, Search, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ShareLayout from '@/layouts/ShareLayout';

const errorConfig = {
    not_found: {
        icon: Search,
        iconBg: 'bg-gray-100 dark:bg-gray-800',
        title: 'Link Not Found',
        description: 'This shared link doesn\'t exist or has been removed. Please check the URL or contact the sender.',
    },
    expired: {
        icon: Clock,
        iconBg: 'bg-red-50 dark:bg-red-950',
        title: 'Link Expired',
        description: 'This shared link has expired and is no longer available. Please contact the sender for a new link.',
    },
    wrong_password: {
        icon: ShieldAlert,
        iconBg: 'bg-amber-50 dark:bg-amber-950',
        title: 'Access Denied',
        description: 'The password you entered is incorrect. Please try again.',
    },
} as const;

export default function ShareError({ reason }: { reason: keyof typeof errorConfig }) {
    const config = errorConfig[reason] ?? errorConfig.not_found;
    const Icon = config.icon;

    return (
        <ShareLayout>
            <Head title={`Error — ${config.title}`} />
            <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:bg-gray-900">
                <div className={`mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full ${config.iconBg}`}>
                    <Icon className="h-7 w-7 text-gray-500 dark:text-gray-400" />
                </div>
                <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                    {config.title}
                </h1>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                    {config.description}
                </p>
                <Button
                    variant="outline"
                    className="mt-6"
                    onClick={() => window.location.href = '/'}
                >
                    ← Back to CloudX
                </Button>
            </div>
        </ShareLayout>
    );
}
