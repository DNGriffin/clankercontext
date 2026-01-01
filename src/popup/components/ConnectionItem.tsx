import React from 'react';
import { Button } from '@/components/ui/button';
import { Power, PowerOff, Pencil, Trash2, Link2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Connection } from '@/shared/types';

interface ConnectionItemProps {
  connection: Connection;
  onEdit: () => void;
  onToggle: (id: string, enabled: boolean) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onSelectSession: (connection: Connection) => void;
}

export function ConnectionItem({
  connection,
  onEdit,
  onToggle,
  onDelete,
  onSelectSession,
}: ConnectionItemProps): React.ReactElement {
  const hasSession = !!connection.selectedSessionId;

  return (
    <div className="flex flex-col gap-1 px-3 py-2 hover:bg-muted/50">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div
            className={cn(
              'h-2 w-2 rounded-full shrink-0',
              connection.enabled ? 'bg-green-500' : 'bg-muted-foreground'
            )}
          />
          <span className="text-sm font-medium truncate">{connection.name}</span>
        </div>
        <div className="flex items-center shrink-0">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={() => onToggle(connection.id, !connection.enabled)}
            title={connection.enabled ? 'Disable' : 'Enable'}
          >
            {connection.enabled ? (
              <Power className="h-3 w-3 text-green-500" />
            ) : (
              <PowerOff className="h-3 w-3 text-muted-foreground" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={onEdit}
            title="Edit"
          >
            <Pencil className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
            onClick={() => onDelete(connection.id)}
            title="Delete"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Session selector row - only for opencode type */}
      {connection.type === 'opencode' && (
        <button
          className="flex items-center gap-2 text-left ml-4 py-1 rounded hover:bg-muted/50 -mx-1 px-1"
          onClick={() => onSelectSession(connection)}
        >
          <Link2 className={cn('h-3 w-3 shrink-0', hasSession ? 'text-primary' : 'text-muted-foreground')} />
          <span className={cn('text-xs truncate flex-1', hasSession ? 'text-foreground' : 'text-muted-foreground')}>
            {hasSession ? connection.selectedSessionTitle : 'Click to select session...'}
          </span>
          {connection.autoSend !== false && (
            <span className="text-xs text-muted-foreground">Auto</span>
          )}
        </button>
      )}
    </div>
  );
}
