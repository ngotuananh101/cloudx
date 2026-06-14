import type { PropsWithChildren } from 'react';
import { ThemeToggle } from '@/components/ThemeToggle';

export default function ShareLayout({ children }: PropsWithChildren) {
    return (
        <div className="relative flex min-h-screen flex-col bg-muted">
            <div className="absolute top-4 right-4">
                <ThemeToggle />
            </div>
            <div className="flex flex-1 items-center justify-center px-4 py-12">
                {children}
            </div>
            <footer className="pb-6 text-center text-xs text-muted-foreground">
                Powered by <span className="font-semibold text-foreground">CloudX</span> — Your Digital Curator
            </footer>
        </div>
    );
}
