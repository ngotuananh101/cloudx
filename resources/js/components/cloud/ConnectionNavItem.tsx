import { Link } from '@inertiajs/react';
import { Cloud } from 'lucide-react';
import ConnectionActionsMenu from '@/components/cloud/ConnectionActionsMenu';
import type { CloudConnection } from '@/types/cloud';

interface ConnectionNavItemProps {
    connection: CloudConnection;
    href: string;
    isActive: boolean;
    onEditName: (connection: CloudConnection) => void;
    onDelete: (connection: CloudConnection) => void;
}

export default function ConnectionNavItem({ connection, href, isActive, onEditName, onDelete }: ConnectionNavItemProps) {
    return (
        <li>
            <div className={`group relative flex items-center justify-between gap-2 rounded-lg px-3 py-3 text-xs font-bold tracking-wide transition-colors ${isActive ? 'bg-red-50 text-brand' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'}`}>
                {isActive && <div className="absolute top-1/2 left-0 h-7 w-1 -translate-y-1/2 rounded-r-md bg-brand" />}
                <Link href={href} className="flex min-w-0 flex-1 items-center gap-3 truncate">
                    {connection.provider_icon?.endsWith('.svg') ? (
                        <img
                            src={connection.provider_icon}
                            className="h-4.5 w-4.5 shrink-0"
                            alt={connection.name}
                        />
                    ) : (
                        <Cloud className={`h-4.5 w-4.5 shrink-0 ${isActive ? 'text-brand' : 'text-gray-400 group-hover:text-gray-600'}`} />
                    )}
                    <span
                        className={`truncate font-bold ${isActive ? 'text-brand' : 'text-gray-700'}`}
                        title={connection.name}
                    >
                        {connection.name}
                    </span>
                </Link>
                <ConnectionActionsMenu connection={connection} onEditName={onEditName} onDelete={onDelete} />
            </div>
        </li>
    );
}
