import React, { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Plus, Loader2, AlertCircle, ChevronDown, ChevronRight } from 'lucide-react';
import type { Connection, IssueType, OpenCodeSession, VSCodeInstance } from '@/shared/types';
import type { ConnectionsResponse, ConnectionMutationResponse, TestConnectionResponse } from '@/shared/messages';
import { storageManager } from '@/background/StorageManager';
import { PROMPT_TEMPLATE_LABELS } from '@/prompts/templates';
import { ConnectionItem } from './components/ConnectionItem';
import { ConnectionForm } from './components/ConnectionForm';
import { SessionPicker } from './components/SessionPicker';
import { InstancePicker } from './components/InstancePicker';

interface SettingsViewProps {
  onBack: () => void;
  onEditPrompt: (type: IssueType) => void;
}

interface PromptTemplateState {
  type: IssueType;
  label: string;
  isCustom: boolean;
  updatedAt?: number;
}

const PROMPT_TEMPLATE_ORDER: IssueType[] = ['fix', 'enhancement'];

export function SettingsView({ onBack, onEditPrompt }: SettingsViewProps): React.ReactElement {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingConnection, setEditingConnection] = useState<Connection | null>(
    null
  );
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [promptTemplates, setPromptTemplates] = useState<PromptTemplateState[]>([]);
  const [promptTemplatesLoading, setPromptTemplatesLoading] = useState(true);
  const [connectionsOpen, setConnectionsOpen] = useState(true);
  const [promptsOpen, setPromptsOpen] = useState(true);

  // Session picker state (for OpenCode)
  const [sessionPickerConnection, setSessionPickerConnection] = useState<Connection | null>(null);

  // Instance picker state (for VSCode)
  const [instancePickerConnection, setInstancePickerConnection] = useState<Connection | null>(null);

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

  const fetchPromptTemplates = useCallback(async () => {
    try {
      setPromptTemplatesLoading(true);
      const storedTemplates = await Promise.all(
        PROMPT_TEMPLATE_ORDER.map((type) => storageManager.getPromptTemplate(type))
      );
      const nextTemplates = storedTemplates.map((stored, index) => {
        const type = PROMPT_TEMPLATE_ORDER[index];
        return {
          type,
          label: PROMPT_TEMPLATE_LABELS[type],
          isCustom: Boolean(stored),
          updatedAt: stored?.updatedAt,
        } as PromptTemplateState;
      });
      setPromptTemplates(nextTemplates);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load prompt templates');
    } finally {
      setPromptTemplatesLoading(false);
    }
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
    fetchPromptTemplates();
  }, [fetchConnections, fetchPromptTemplates]);

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

  const handleSetActive = useCallback(
    async (id: string) => {
      try {
        const response = (await chrome.runtime.sendMessage({
          type: 'SET_ACTIVE_CONNECTION',
          connectionId: id,
        })) as ConnectionMutationResponse;
        if (response.error) {
          throw new Error(response.error);
        }
        await fetchConnections();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to set active connection');
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
          setEditingConnection(null);
          await fetchConnections();
        } else {
          const response = (await chrome.runtime.sendMessage({
            type: 'ADD_CONNECTION',
            connection: data,
          })) as ConnectionMutationResponse;
          if (response.error) {
            throw new Error(response.error);
          }
          setIsAddingNew(false);
          await fetchConnections();
          // Immediately open session/instance picker for the new connection
          if (response.connection) {
            if (data.type === 'opencode') {
              setSessionPickerConnection(response.connection);
            } else if (data.type === 'vscode') {
              setInstancePickerConnection(response.connection);
            }
          }
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to save connection');
      }
    },
    [editingConnection, fetchConnections]
  );

  // Handle session selection from picker (OpenCode)
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

  // Handle instance selection from picker (VSCode)
  const handleInstanceSelect = useCallback(
    async (instance: VSCodeInstance) => {
      if (!instancePickerConnection) return;

      try {
        const response = (await chrome.runtime.sendMessage({
          type: 'UPDATE_CONNECTION',
          connection: {
            ...instancePickerConnection,
            selectedInstanceId: instance.id,
            selectedInstanceName: instance.name || 'Untitled Workspace',
            selectedInstancePath: instance.workspacePath,
            selectedInstancePort: instance.port,
          },
        })) as ConnectionMutationResponse;

        if (response.error) {
          throw new Error(response.error);
        }

        setInstancePickerConnection(null);
        await fetchConnections();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to save instance');
        setInstancePickerConnection(null);
      }
    },
    [instancePickerConnection, fetchConnections]
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

  if (instancePickerConnection) {
    return (
      <InstancePicker
        connection={instancePickerConnection}
        onSelect={handleInstanceSelect}
        onClose={() => setInstancePickerConnection(null)}
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
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => setConnectionsOpen((prev) => !prev)}
              title={connectionsOpen ? 'Collapse connections' : 'Expand connections'}
              aria-label={connectionsOpen ? 'Collapse connections' : 'Expand connections'}
            >
              {connectionsOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            </Button>
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
        </div>

        {connectionsOpen ? (
          loading ? (
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
                  onSelectInstance={setInstancePickerConnection}
                  onSetActive={handleSetActive}
                />
              ))}
            </div>
          )
        ) : null}
      </section>

      <section className="mb-2">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Prompts
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={() => setPromptsOpen((prev) => !prev)}
            title={promptsOpen ? 'Collapse prompts' : 'Expand prompts'}
            aria-label={promptsOpen ? 'Collapse prompts' : 'Expand prompts'}
          >
            {promptsOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </Button>
        </div>

        {promptsOpen ? (
          promptTemplatesLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {promptTemplates.map((template) => {
                const lastUpdated = template.updatedAt
                  ? new Date(template.updatedAt).toLocaleString()
                  : null;
                const status = template.isCustom
                  ? `Custom${lastUpdated ? ` - Updated ${lastUpdated}` : ''}`
                  : 'Default';
                return (
                  <div
                    key={template.type}
                    className="flex items-center justify-between gap-3 rounded-md border px-3 py-2"
                  >
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{template.label} prompt</span>
                      <span className="text-[11px] text-muted-foreground">{status}</span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onEditPrompt(template.type)}
                    >
                      Edit
                    </Button>
                  </div>
                );
              })}
            </div>
          )
        ) : null}
      </section>

    </div>
  );
}
