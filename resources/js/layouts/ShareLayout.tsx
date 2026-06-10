import type { PropsWithChildren } from 'react';
import { ThemeToggle } from '@/components/ThemeToggle';

export default function ShareLayout({ children }: PropsWithChildren) {
    return (
        <div className="relative flex min-h-screen flex-col bg-[#f8f9fa] dark:bg-gray-950">
            <div className="absolute top-4 right-4">
                <ThemeToggle />
            </div>
            <div className="flex flex-1 items-center justify-center px-4 py-12">
                {children}
            </div>
            <footer className="pb-6 text-center text-xs text-gray-400 dark:text-gray-600">
                Powered by <span className="font-semibold text-gray-500 dark:text-gray-400">CloudX</span> — Your Digital Curator
            </footer>
        </div>
    );
}
