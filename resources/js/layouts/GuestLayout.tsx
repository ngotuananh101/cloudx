import type { PropsWithChildren } from 'react';
import { ThemeToggle } from '@/components/ThemeToggle';

export default function GuestLayout({ children }: PropsWithChildren) {
    return (
        <div className="relative flex min-h-screen items-center justify-center bg-muted">
            <div className="absolute top-4 right-4">
                <ThemeToggle />
            </div>
            <div className="w-full max-w-md rounded-2xl bg-card p-8 shadow-sm">
                {children}
            </div>
        </div>
    );
}
