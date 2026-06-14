import { Link } from '@inertiajs/react';
import { Cloud } from 'lucide-react';
import ConnectionActionsMenu from '@/components/cloud/ConnectionActionsMenu';
import type { CloudConnection } from '@/types/cloud';

interface ConnectionNavItemProps {
    connection: CloudConnection;
    href: string;
    isActive: boolean;
    onEditName: (connection: CloudConnection) => void;
    onEditConnection: (connection: CloudConnection) => void;
    onDelete: (connection: CloudConnection) => void;
}

export default function ConnectionNavItem({
    connection,
    href,
    isActive,
    onEditName,
    onEditConnection,
    onDelete,
}: ConnectionNavItemProps) {
    return (
        <li>
            <div
                className={`group relative flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-xs font-bold tracking-wide transition-colors ${isActive ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
            >
                {isActive && (
                    <div className="absolute top-1/2 left-0 h-7 w-1 -translate-y-1/2 rounded-r-md bg-primary" />
                )}
                <Link
                    href={href}
                    className="flex min-w-0 flex-1 items-center gap-3 truncate"
                >
                    {connection.provider_icon?.endsWith('.svg') ? (
                        <img
                            src={connection.provider_icon}
                            className="h-4.5 w-4.5 shrink-0"
                            alt={connection.name}
                        />
                    ) : (
                        <Cloud
                            className={`h-4.5 w-4.5 shrink-0 ${isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'}`}
                        />
                    )}
                    <span
                        className={`truncate font-bold ${isActive ? 'text-primary' : 'text-foreground'}`}
                        title={connection.name}
                    >
                        {connection.name}
                    </span>
                </Link>
                <ConnectionActionsMenu
                    connection={connection}
                    onEditName={onEditName}
                    onEditConnection={onEditConnection}
                    onDelete={onDelete}
                />
            </div>
        </li>
    );
}
