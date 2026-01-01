import React, { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { X, Loader2, AlertCircle } from 'lucide-react';
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
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-3">
      <div className="bg-background border rounded-lg shadow-lg w-full max-w-sm">
        <div className="flex items-center justify-between px-3 py-2 border-b">
          <div className="flex flex-col">
            <h3 className="text-sm font-semibold">Select OpenCode Session</h3>
            <span className="text-xs text-muted-foreground truncate max-w-[200px]">
              {connection.name}
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-2 py-6 px-4 text-center">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <p className="text-sm text-destructive">{error}</p>
            <Button variant="outline" size="sm" onClick={fetchSessions}>
              Retry
            </Button>
          </div>
        ) : sessions.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-6 px-4 text-center">
            <p className="text-sm text-muted-foreground">
              No active sessions found.
            </p>
            <p className="text-xs text-muted-foreground">
              Start a session in OpenCode first.
            </p>
          </div>
        ) : (
          <div className="flex flex-col divide-y max-h-[200px] overflow-y-auto">
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
        )}
      </div>
    </div>
  );
}
