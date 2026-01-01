import React, { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Plus, Loader2, AlertCircle } from 'lucide-react';
import type { Connection, OpenCodeSession } from '@/shared/types';
import type { ConnectionsResponse, ConnectionMutationResponse, TestConnectionResponse } from '@/shared/messages';
import { ConnectionItem } from './components/ConnectionItem';
import { ConnectionForm } from './components/ConnectionForm';
import { SessionPicker } from './components/SessionPicker';

interface SettingsViewProps {
  onBack: () => void;
}

export function SettingsView({ onBack }: SettingsViewProps): React.ReactElement {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingConnection, setEditingConnection] = useState<Connection | null>(
    null
  );
  const [isAddingNew, setIsAddingNew] = useState(false);

  // Session picker state
  const [sessionPickerConnection, setSessionPickerConnection] = useState<Connection | null>(null);

  // Connection health status: true = healthy, false = unhealthy, undefined = checking
  const [connectionHealth, setConnectionHealth] = useState<Record<string, boolean | undefined>>({});

  // Check health of all connections
  const checkConnectionsHealth = useCallback(async (conns: Connection[]) => {
    // Set all to checking (undefined)
    const initialHealth: Record<string, boolean | undefined> = {};
    conns.forEach(c => { initialHealth[c.id] = undefined; });
    setConnectionHealth(initialHealth);

    // Check each connection in parallel
    await Promise.all(
      conns.map(async (conn) => {
        try {
          const response = (await chrome.runtime.sendMessage({
            type: 'TEST_CONNECTION',
            connectionId: conn.id,
          })) as TestConnectionResponse;
          setConnectionHealth(prev => ({ ...prev, [conn.id]: response.success }));
        } catch {
          setConnectionHealth(prev => ({ ...prev, [conn.id]: false }));
        }
      })
    );
  }, []);

  const fetchConnections = useCallback(async () => {
    try {
      setLoading(true);
      const response = (await chrome.runtime.sendMessage({
        type: 'GET_CONNECTIONS',
      })) as ConnectionsResponse;
      setConnections(response.connections);
      setError(null);
      // Check health of all connections after fetching
      checkConnectionsHealth(response.connections);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load connections');
    } finally {
      setLoading(false);
    }
  }, [checkConnectionsHealth]);

  useEffect(() => {
    fetchConnections();
  }, [fetchConnections]);

  const handleToggle = useCallback(
    async (id: string, enabled: boolean) => {
      try {
        const response = (await chrome.runtime.sendMessage({
          type: 'TOGGLE_CONNECTION',
          connectionId: id,
          enabled,
        })) as ConnectionMutationResponse;
        if (response.error) {
          throw new Error(response.error);
        }
        await fetchConnections();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to toggle connection');
      }
    },
    [fetchConnections]
  );

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        const response = (await chrome.runtime.sendMessage({
          type: 'DELETE_CONNECTION',
          connectionId: id,
        })) as ConnectionMutationResponse;
        if (response.error) {
          throw new Error(response.error);
        }
        await fetchConnections();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to delete connection');
      }
    },
    [fetchConnections]
  );

  const handleSave = useCallback(
    async (
      data: Omit<Connection, 'id' | 'createdAt' | 'updatedAt'>
    ) => {
      try {
        if (editingConnection) {
          const response = (await chrome.runtime.sendMessage({
            type: 'UPDATE_CONNECTION',
            connection: {
              ...editingConnection,
              ...data,
            },
          })) as ConnectionMutationResponse;
          if (response.error) {
            throw new Error(response.error);
          }
        } else {
          const response = (await chrome.runtime.sendMessage({
            type: 'ADD_CONNECTION',
            connection: data,
          })) as ConnectionMutationResponse;
          if (response.error) {
            throw new Error(response.error);
          }
        }
        setEditingConnection(null);
        setIsAddingNew(false);
        await fetchConnections();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to save connection');
      }
    },
    [editingConnection, fetchConnections]
  );

  // Handle session selection from picker
  const handleSessionSelect = useCallback(
    async (session: OpenCodeSession) => {
      if (!sessionPickerConnection) return;

      try {
        const response = (await chrome.runtime.sendMessage({
          type: 'UPDATE_CONNECTION',
          connection: {
            ...sessionPickerConnection,
            selectedSessionId: session.id,
            selectedSessionTitle: session.title || 'Untitled Session',
          },
        })) as ConnectionMutationResponse;

        if (response.error) {
          throw new Error(response.error);
        }

        setSessionPickerConnection(null);
        await fetchConnections();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to save session');
        setSessionPickerConnection(null);
      }
    },
    [sessionPickerConnection, fetchConnections]
  );

  if (sessionPickerConnection) {
    return (
      <SessionPicker
        connection={sessionPickerConnection}
        onSelect={handleSessionSelect}
        onClose={() => setSessionPickerConnection(null)}
      />
    );
  }

  if (isAddingNew || editingConnection) {
    return (
      <ConnectionForm
        connection={editingConnection}
        onSave={handleSave}
        onCancel={() => {
          setIsAddingNew(false);
          setEditingConnection(null);
        }}
      />
    );
  }

  return (
    <div className="flex flex-col h-full p-3">
      <div className="flex items-center gap-2 mb-4">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={onBack}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-base font-semibold">Settings</h2>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive mb-3">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <section className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Connections
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={() => setIsAddingNew(true)}
            title="Add connection"
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : connections.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-4 text-center">
            <p className="text-sm text-muted-foreground">
              No connections configured
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsAddingNew(true)}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add connection
            </Button>
          </div>
        ) : (
          <div className="flex flex-col border rounded-md divide-y">
            {connections.map((conn) => (
              <ConnectionItem
                key={conn.id}
                connection={conn}
                healthStatus={connectionHealth[conn.id]}
                onEdit={() => setEditingConnection(conn)}
                onToggle={handleToggle}
                onDelete={handleDelete}
                onSelectSession={setSessionPickerConnection}
              />
            ))}
          </div>
        )}
      </section>

    </div>
  );
}
