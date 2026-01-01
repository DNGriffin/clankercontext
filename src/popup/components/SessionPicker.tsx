import React, { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, AlertCircle } from 'lucide-react';
import type { Connection, OpenCodeSession } from '@/shared/types';
import type { OpenCodeSessionsResponse } from '@/shared/messages';

interface SessionPickerProps {
  connection: Connection;
  onSelect: (session: OpenCodeSession) => void;
  onClose: () => void;
}

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export function SessionPicker({
  connection,
  onSelect,
  onClose,
}: SessionPickerProps): React.ReactElement {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessions, setSessions] = useState<OpenCodeSession[]>([]);

  const fetchSessions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = (await chrome.runtime.sendMessage({
        type: 'GET_OPENCODE_SESSIONS',
        connectionId: connection.id,
      })) as OpenCodeSessionsResponse;

      if (response.error) {
        setError(response.error);
        setSessions([]);
      } else {
        setSessions(response.sessions);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch sessions');
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, [connection.id]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

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
          <h3 className="text-base font-semibold">Select Session</h3>
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
            Failed to fetch sessions.
          </p>
          <p className="text-xs text-muted-foreground">
            Ensure that OpenCode is running.
          </p>
          <Button variant="outline" size="sm" onClick={fetchSessions}>
            Retry
          </Button>
        </div>
      ) : sessions.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-6 px-4 text-center flex-1">
          <p className="text-sm text-muted-foreground">
            No active sessions found.
          </p>
          <p className="text-xs text-muted-foreground">
            Start a session in OpenCode first.
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            Don't see your session? Make sure you've sent at least one chat first for it to show up here.
          </p>
        </div>
      ) : (
        <div className="flex flex-col flex-1">
          <div className="flex flex-col border rounded-md divide-y flex-1 overflow-y-auto">
            {sessions.map((session) => (
              <button
                key={session.id}
                className="flex flex-col px-3 py-2 text-left hover:bg-muted/50 transition-colors"
                onClick={() => onSelect(session)}
              >
                <span className="text-sm font-medium truncate">
                  {session.title || 'Untitled Session'}
                </span>
                <span className="text-xs text-muted-foreground truncate">
                  {session.directory} &bull; {formatTimeAgo(session.updatedAt)}
                </span>
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground text-center mt-3">
            Don't see your session? Make sure you've sent at least one chat first for it to show up here.
          </p>
        </div>
      )}
    </div>
  );
}
