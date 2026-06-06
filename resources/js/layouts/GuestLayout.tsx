import type { PropsWithChildren } from 'react';
import { ThemeToggle } from '@/components/ThemeToggle';

export default function GuestLayout({ children }: PropsWithChildren) {
    return (
        <div className="relative flex min-h-screen items-center justify-center bg-[#f8f9fa] dark:bg-gray-950">
            <div className="absolute top-4 right-4">
                <ThemeToggle />
            </div>
            <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:bg-gray-900">
                {children}
            </div>
        </div>
    );
}
