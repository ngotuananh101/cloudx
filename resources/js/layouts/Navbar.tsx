import { usePage } from '@inertiajs/react';
import { Search, Eraser, RefreshCw, Bell, Settings } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { index as storageIndex } from '@/routes/storage';
import type { PageProps } from '@/types';
import type { CloudConnection } from '@/types/cloud';

interface NavbarProps {
    readonly cloudSearch?: {
        readonly value: string;
        readonly onChange: (value: string) => void;
        readonly placeholder: string;
    };
    readonly cloudActions?: {
        readonly onClearCache?: () => void;
        readonly onSync?: () => void;
    };
}

export function Navbar({ cloudSearch, cloudActions }: Readonly<NavbarProps>) {
    const { url, props } = usePage<PageProps>();
    const user = props.auth?.user;
    const connections = user?.connections || [];
    const pageConnection = props.connection;
    const activeConnection = pageConnection?.storageQuota
        ? pageConnection
        : connections.find((connection: CloudConnection) =>
              url.startsWith(storageIndex.url({ connection: connection.id })),
          );

    return (
        <header className="flex h-18 w-full shrink-0 items-center justify-between border-b border-border bg-card px-8">
            <div className="flex min-w-0 flex-1 items-center gap-6">
                {cloudSearch && activeConnection && (
                    <div className="flex w-full max-w-2xl items-center gap-2">
                        <div className="relative w-full max-w-md">
                            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                                <Search className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <Input
                                type="text"
                                placeholder={cloudSearch.placeholder}
                                value={cloudSearch.value}
                                onChange={(event) =>
                                    cloudSearch.onChange(event.target.value)
                                }
                                className="h-11 w-full rounded-xl border-none bg-muted pl-11 font-semibold text-foreground placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring"
                            />
                        </div>

                        <button
                            type="button"
                            title="Clear Cache"
                            onClick={cloudActions?.onClearCache}
                            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors hover:bg-muted"
                        >
                            <Eraser className="h-5 w-5 text-muted-foreground" />
                        </button>

                        {activeConnection.provider == '7' && (
                            <button
                                type="button"
                                title="Sync"
                                onClick={cloudActions?.onSync}
                                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors hover:bg-muted"
                            >
                                <RefreshCw className="h-5 w-5 text-muted-foreground" />
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Right: Actions and User */}
            <div className="flex items-center gap-4">
                <button className="relative flex h-10 w-10 items-center justify-center rounded-xl transition-colors hover:bg-muted">
                    <Bell className="h-5 w-5 text-muted-foreground" />
                    <span className="absolute top-3 right-3 h-2 w-2 rounded-full bg-primary" />
                </button>

                <button className="flex h-10 w-10 items-center justify-center rounded-xl transition-colors hover:bg-muted">
                    <Settings className="h-5 w-5 text-muted-foreground" />
                </button>

                <ThemeToggle />

                <Avatar className="h-10 w-10 cursor-pointer border border-border shadow-sm">
                    <AvatarImage src="" />
                    <AvatarFallback className="bg-accent text-sm font-bold text-primary">
                        {user?.name
                            ? user.name
                                  .split(' ')
                                  .map((n: string) => n[0])
                                  .join('')
                                  .toUpperCase()
                            : 'U'}
                    </AvatarFallback>
                </Avatar>
            </div>
        </header>
    );
}
