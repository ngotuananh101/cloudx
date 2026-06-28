import { Head } from '@inertiajs/react';
import { Clock, Search, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ShareLayout from '@/layouts/ShareLayout';

const errorConfig = {
    not_found: {
        icon: Search,
        iconBg: 'bg-muted',
        title: 'Link Not Found',
        description:
            "This shared link doesn't exist or has been removed. Please check the URL or contact the sender.",
    },
    expired: {
        icon: Clock,
        iconBg: 'bg-muted',
        title: 'Link Expired',
        description:
            'This shared link has expired and is no longer available. Please contact the sender for a new link.',
    },
    wrong_password: {
        icon: ShieldAlert,
        iconBg: 'bg-muted',
        title: 'Access Denied',
        description: 'The password you entered is incorrect. Please try again.',
    },
} as const;

export default function ShareError({
    reason,
}: {
    reason: keyof typeof errorConfig;
}) {
    const config = errorConfig[reason] ?? errorConfig.not_found;
    const Icon = config.icon;

    return (
        <ShareLayout>
            <Head title={`Error — ${config.title}`} />
            <div className="w-full max-w-md rounded-2xl bg-card p-8 text-center shadow-sm">
                <div
                    className={`mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full ${config.iconBg}`}
                >
                    <Icon className="h-7 w-7 text-muted-foreground" />
                </div>
                <h1 className="text-lg font-bold text-foreground">
                    {config.title}
                </h1>
                <p className="mt-2 text-sm text-muted-foreground">
                    {config.description}
                </p>
                <Button
                    variant="outline"
                    className="mt-6"
                    onClick={() => (globalThis.location.href = '/')}
                >
                    ← Back to CloudX
                </Button>
            </div>
        </ShareLayout>
    );
}
