import React, { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, AlertCircle } from 'lucide-react';
import type { Connection, VSCodeInstance } from '@/shared/types';
import type { VSCodeInstancesResponse } from '@/shared/messages';

interface InstancePickerProps {
  connection: Connection;
  onSelect: (instance: VSCodeInstance) => void;
  onClose: () => void;
}

const INSTANCE_HINT = "Don't see your VSCode? Make sure the ClankerContext extension is installed and running in VSCode.";

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export function InstancePicker({
  connection,
  onSelect,
  onClose,
}: InstancePickerProps): React.ReactElement {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [instances, setInstances] = useState<VSCodeInstance[]>([]);

  const fetchInstances = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = (await chrome.runtime.sendMessage({
        type: 'GET_VSCODE_INSTANCES',
        connectionId: connection.id,
      })) as VSCodeInstancesResponse;

      if (response.error) {
        setError(response.error);
        setInstances([]);
      } else {
        setInstances(response.instances);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch instances');
      setInstances([]);
    } finally {
      setLoading(false);
    }
  }, [connection.id]);

  useEffect(() => {
    fetchInstances();
  }, [fetchInstances]);

  return (
    <div className="flex flex-col p-3 min-h-[400px]">
      <div className="flex items-center gap-2 mb-4">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={onClose}
          type="button"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex flex-col">
          <h3 className="text-base font-semibold">Select VSCode Window</h3>
          <span className="text-xs text-muted-foreground truncate max-w-[200px]">
            {connection.name}
          </span>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8 flex-1">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center gap-2 py-6 px-4 text-center flex-1">
          <AlertCircle className="h-5 w-5 text-destructive" />
          <p className="text-sm text-destructive">
            Failed to fetch VSCode instances.
          </p>
          <p className="text-xs text-muted-foreground">
            Ensure the ClankerContext VSCode extension is running.
          </p>
          <Button variant="outline" size="sm" onClick={fetchInstances}>
            Retry
          </Button>
        </div>
      ) : instances.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-6 px-4 text-center flex-1">
          <p className="text-sm text-muted-foreground">
            No VSCode windows found.
          </p>
          <p className="text-xs text-muted-foreground">
            Open a VSCode window with ClankerContext extension first.
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            {INSTANCE_HINT}
          </p>
          <Button variant="outline" size="sm" onClick={fetchInstances} className="mt-2">
            Refresh
          </Button>
        </div>
      ) : (
        <div className="flex flex-col flex-1">
          <div className="flex flex-col border rounded-md divide-y flex-1 overflow-y-auto">
            {instances.map((instance) => (
              <button
                key={instance.id}
                className="flex flex-col px-3 py-2 text-left hover:bg-muted/50 transition-colors"
                onClick={() => onSelect(instance)}
              >
                <span className="text-sm font-medium truncate">
                  {instance.name || 'Untitled Workspace'}
                </span>
                <span className="text-xs text-muted-foreground truncate">
                  {instance.workspacePath} &bull; {formatTimeAgo(instance.lastHeartbeat)}
                </span>
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground text-center mt-3">
            {INSTANCE_HINT}
          </p>
        </div>
      )}
    </div>
  );
}
