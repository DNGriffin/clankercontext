import React from 'react';
import { Button } from '@/components/ui/button';
import { Power, PowerOff, Pencil, Trash2, Link2, Loader2, Circle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Connection } from '@/shared/types';

interface ConnectionItemProps {
  connection: Connection;
  healthStatus?: boolean; // true = healthy, false = unhealthy, undefined = checking
  onEdit: () => void;
  onToggle: (id: string, enabled: boolean) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onSelectSession: (connection: Connection) => void;
  onSelectInstance: (connection: Connection) => void;
  onSetActive: (id: string) => Promise<void>;
}

export function ConnectionItem({
  connection,
  healthStatus,
  onEdit,
  onToggle,
  onDelete,
  onSelectSession,
  onSelectInstance,
  onSetActive,
}: ConnectionItemProps): React.ReactElement {
  const hasSession = !!connection.selectedSessionId;
  const hasInstance = !!connection.selectedInstanceId;
  const isActive = !!connection.isActive;

  // Determine indicator color based on enabled state and health
  // If not enabled, show gray regardless of health
  // If enabled: green = healthy, red = unhealthy, spinner = checking
  const getIndicator = () => {
    if (!connection.enabled) {
      return <div className="h-2 w-2 rounded-full shrink-0 bg-muted-foreground" />;
    }
    if (healthStatus === undefined) {
      return <Loader2 className="h-2 w-2 shrink-0 animate-spin text-muted-foreground" />;
    }
    return (
      <div
        className={cn(
          'h-2 w-2 rounded-full shrink-0',
          healthStatus ? 'bg-green-500' : 'bg-red-500'
        )}
      />
    );
  };

  return (
    <div className={cn(
      "flex flex-col gap-1 px-3 py-2 hover:bg-muted/50",
      isActive && "bg-primary/5 border-l-2 border-l-primary"
    )}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <button
            onClick={() => onSetActive(connection.id)}
            className="shrink-0"
            title={isActive ? 'Active connection' : 'Set as active connection'}
          >
            {isActive ? (
              <CheckCircle2 className="h-4 w-4 text-primary" />
            ) : (
              <Circle className="h-4 w-4 text-muted-foreground hover:text-primary" />
            )}
          </button>
          {getIndicator()}
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

      {/* Instance selector row - only for vscode type */}
      {connection.type === 'vscode' && (
        <button
          className="flex items-center gap-2 text-left ml-4 py-1 rounded hover:bg-muted/50 -mx-1 px-1"
          onClick={() => onSelectInstance(connection)}
        >
          <Link2 className={cn('h-3 w-3 shrink-0', hasInstance ? 'text-primary' : 'text-muted-foreground')} />
          <span className={cn('text-xs truncate flex-1', hasInstance ? 'text-foreground' : 'text-muted-foreground')}>
            {hasInstance ? connection.selectedInstanceName : 'Click to select VSCode window...'}
          </span>
          {connection.autoSend !== false && (
            <span className="text-xs text-muted-foreground">Auto</span>
          )}
        </button>
      )}
    </div>
  );
}
