import {
    MoreHorizontal,
    Pencil,
    RefreshCw,
    Settings2,
    Trash2,
} from 'lucide-react';
import { reconnect } from '@/actions/App/Http/Controllers/CloudConnectionController';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { CloudConnection } from '@/types/cloud';

interface ConnectionActionsMenuProps {
    connection: CloudConnection;
    onEditName: (connection: CloudConnection) => void;
    onEditConnection: (connection: CloudConnection) => void;
    onDelete: (connection: CloudConnection) => void;
}

export default function ConnectionActionsMenu({
    connection,
    onEditName,
    onEditConnection,
    onDelete,
}: ConnectionActionsMenuProps) {
    const actions = connection.actions;

    if (
        !actions ||
        (!actions.canReconnect &&
            !actions.canEditName &&
            !actions.canEditConnection &&
            !actions.canDelete)
    ) {
        return null;
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0 rounded-lg text-gray-400 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-white/70 hover:text-gray-700 data-[state=open]:bg-white/70 data-[state=open]:opacity-100"
                    aria-label={`Open actions for ${connection.name}`}
                    onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                    }}
                >
                    <MoreHorizontal className="h-4 w-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
                {actions.canReconnect && (
                    <DropdownMenuItem asChild>
                        <a href={reconnect.url(connection)}>
                            <RefreshCw className="h-4 w-4" />
                            Reconnect
                        </a>
                    </DropdownMenuItem>
                )}
                {actions.canEditName && (
                    <DropdownMenuItem
                        onSelect={(event) => {
                            event.preventDefault();
                            onEditName(connection);
                        }}
                    >
                        <Pencil className="h-4 w-4" />
                        Edit name
                    </DropdownMenuItem>
                )}
                {actions.canEditConnection && (
                    <DropdownMenuItem
                        onSelect={(event) => {
                            event.preventDefault();
                            onEditConnection(connection);
                        }}
                    >
                        <Settings2 className="h-4 w-4" />
                        Edit connection
                    </DropdownMenuItem>
                )}
                {actions.canDelete &&
                    (actions.canReconnect ||
                        actions.canEditName ||
                        actions.canEditConnection) && <DropdownMenuSeparator />}
                {actions.canDelete && (
                    <DropdownMenuItem
                        variant="destructive"
                        onSelect={(event) => {
                            event.preventDefault();
                            onDelete(connection);
                        }}
                    >
                        <Trash2 className="h-4 w-4" />
                        Delete connection
                    </DropdownMenuItem>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
