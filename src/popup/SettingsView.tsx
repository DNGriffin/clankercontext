import React, { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Plus, Loader2, AlertCircle, ChevronDown, ChevronRight } from 'lucide-react';
import type { Connection, CustomAttribute, IssueType, OpenCodeSession, VSCodeInstance } from '@/shared/types';
import type { ConnectionsResponse, ConnectionMutationResponse, CustomAttributesResponse, CustomAttributeMutationResponse, TestConnectionResponse } from '@/shared/messages';
import { storageManager } from '@/background/StorageManager';
import { PROMPT_TEMPLATE_LABELS } from '@/prompts/templates';
import { ConnectionItem } from './components/ConnectionItem';
import { ConnectionForm } from './components/ConnectionForm';
import { SessionPicker } from './components/SessionPicker';
import { InstancePicker } from './components/InstancePicker';
import { CustomAttributeItem } from './components/CustomAttributeItem';
import { CustomAttributeForm } from './components/CustomAttributeForm';

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

const PROMPT_TEMPLATE_ORDER: IssueType[] = ['enhancement', 'fix'];

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
  const [behaviorOpen, setBehaviorOpen] = useState(true);
  const [autoCopyOnLog, setAutoCopyOnLog] = useState(true);
  const [autoCopyLoading, setAutoCopyLoading] = useState(true);

  // Custom attributes state
  const [customAttributes, setCustomAttributes] = useState<CustomAttribute[]>([]);
  const [customAttributesLoading, setCustomAttributesLoading] = useState(true);
  const [customAttributesOpen, setCustomAttributesOpen] = useState(true);
  const [isAddingAttribute, setIsAddingAttribute] = useState(false);
  const [editingAttribute, setEditingAttribute] = useState<CustomAttribute | null>(null);

  // Session picker state (for OpenCode)
  const [sessionPickerConnection, setSessionPickerConnection] = useState<Connection | null>(null);

  // Instance picker state (for VSCode)
  const [instancePickerConnection, setInstancePickerConnection] = useState<Connection | null>(null);

  // Connection health status: true = healthy, false = unhealthy, undefined = checking
  const [connectionHealth, setConnectionHealth] = useState<Record<string, boolean | undefined>>({});

  // Check health of all connections
  const checkConnectionsHealth = useCallback(async (
    conns: Connection[],
    resetHealth: boolean = true
  ) => {
    if (resetHealth) {
      // Set all to checking (undefined)
      const initialHealth: Record<string, boolean | undefined> = {};
      conns.forEach(c => { initialHealth[c.id] = undefined; });
      setConnectionHealth(initialHealth);
    }

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

  const fetchCustomAttributes = useCallback(async () => {
    try {
      setCustomAttributesLoading(true);
      const response = (await chrome.runtime.sendMessage({
        type: 'GET_CUSTOM_ATTRIBUTES',
      })) as CustomAttributesResponse;
      setCustomAttributes(response.customAttributes);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load custom attributes');
    } finally {
      setCustomAttributesLoading(false);
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
    fetchCustomAttributes();
  }, [fetchConnections, fetchPromptTemplates, fetchCustomAttributes]);

  // Load auto-copy setting
  useEffect(() => {
    const loadAutoCopySetting = async () => {
      try {
        const result = await chrome.storage.local.get('autoCopyOnLog');
        // Default to true if not set
        setAutoCopyOnLog(result.autoCopyOnLog !== false);
      } catch (e) {
        console.error('Failed to load auto-copy setting:', e);
      } finally {
        setAutoCopyLoading(false);
      }
    };
    loadAutoCopySetting();
  }, []);

  const handleAutoCopyToggle = useCallback(async () => {
    const newValue = !autoCopyOnLog;
    setAutoCopyOnLog(newValue);
    try {
      await chrome.storage.local.set({ autoCopyOnLog: newValue });
    } catch (e) {
      // Revert on error
      setAutoCopyOnLog(!newValue);
      setError(e instanceof Error ? e.message : 'Failed to save setting');
    }
  }, [autoCopyOnLog]);

  const handleSaveAttribute = useCallback(
    async (data: Omit<CustomAttribute, 'id' | 'createdAt' | 'updatedAt'>) => {
      try {
        if (editingAttribute) {
          const response = (await chrome.runtime.sendMessage({
            type: 'UPDATE_CUSTOM_ATTRIBUTE',
            attribute: {
              ...editingAttribute,
              ...data,
            },
          })) as CustomAttributeMutationResponse;
          if (response.error) {
            throw new Error(response.error);
          }
          setEditingAttribute(null);
        } else {
          const response = (await chrome.runtime.sendMessage({
            type: 'ADD_CUSTOM_ATTRIBUTE',
            attribute: data,
          })) as CustomAttributeMutationResponse;
          if (response.error) {
            throw new Error(response.error);
          }
          setIsAddingAttribute(false);
        }
        await fetchCustomAttributes();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to save custom attribute');
      }
    },
    [editingAttribute, fetchCustomAttributes]
  );

  const handleDeleteAttribute = useCallback(
    async (id: string) => {
      try {
        const response = (await chrome.runtime.sendMessage({
          type: 'DELETE_CUSTOM_ATTRIBUTE',
          attributeId: id,
        })) as CustomAttributeMutationResponse;
        if (response.error) {
          throw new Error(response.error);
        }
        await fetchCustomAttributes();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to delete custom attribute');
      }
    },
    [fetchCustomAttributes]
  );

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
        const nextConnections = connections.map((conn) => ({
          ...conn,
          isActive: conn.id === id,
        }));
        setConnections(nextConnections);
        checkConnectionsHealth(nextConnections, false);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to set active connection');
      }
    },
    [checkConnectionsHealth, connections]
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
            selectedSessionDirectory: session.directory,
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

  if (isAddingAttribute || editingAttribute) {
    return (
      <CustomAttributeForm
        attribute={editingAttribute}
        onSave={handleSaveAttribute}
        onCancel={() => {
          setIsAddingAttribute(false);
          setEditingAttribute(null);
        }}
      />
    );
  }

  return (
    <div className="flex flex-col h-full p-3">
      <div className="flex items-center gap-2 mb-2">
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
        <div className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive mb-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <section className="mb-3">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-[0.15em]">
            CONNECTIONS
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
            <div className="flex justify-center py-2">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : connections.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-2 text-center">
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
            <div className="flex flex-col border border-border rounded-sm divide-y divide-border">
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
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-[0.15em]">
            PROMPTS
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
            <div className="flex justify-center py-2">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
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
                    className="flex items-center justify-between gap-3 rounded-sm border border-border px-3 py-2"
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

      <section className="mb-2">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-[0.15em]">
            BEHAVIOR
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={() => setBehaviorOpen((prev) => !prev)}
            title={behaviorOpen ? 'Collapse behavior' : 'Expand behavior'}
            aria-label={behaviorOpen ? 'Collapse behavior' : 'Expand behavior'}
          >
            {behaviorOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </Button>
        </div>

        {behaviorOpen ? (
          autoCopyLoading ? (
            <div className="flex justify-center py-2">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-3 rounded-sm border border-border px-3 py-2">
                <div className="flex flex-col">
                  <span className="text-sm font-medium">Auto Copy Context</span>
                  <span className="text-[11px] text-muted-foreground">
                    Automatically copy context to clipboard after logging an issue
                  </span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={autoCopyOnLog}
                  onClick={handleAutoCopyToggle}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                    autoCopyOnLog ? 'bg-primary' : 'bg-input'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-background shadow-lg ring-0 transition duration-200 ease-in-out ${
                      autoCopyOnLog ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
          )
        ) : null}
      </section>

      <section className="mb-2">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-[0.15em]">
            CUSTOM ATTRIBUTES
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => setCustomAttributesOpen((prev) => !prev)}
              title={customAttributesOpen ? 'Collapse custom attributes' : 'Expand custom attributes'}
              aria-label={customAttributesOpen ? 'Collapse custom attributes' : 'Expand custom attributes'}
            >
              {customAttributesOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => setIsAddingAttribute(true)}
              title="Add custom attribute"
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {customAttributesOpen ? (
          customAttributesLoading ? (
            <div className="flex justify-center py-2">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : customAttributes.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-2 text-center">
              <p className="text-sm text-muted-foreground">
                No custom attributes configured
              </p>
              <p className="text-xs text-muted-foreground max-w-[250px]">
                Add attributes like data-testid or data-qa to capture when selecting elements
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsAddingAttribute(true)}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add attribute
              </Button>
            </div>
          ) : (
            <div className="flex flex-col border border-border rounded-sm divide-y divide-border">
              {customAttributes.map((attr) => (
                <CustomAttributeItem
                  key={attr.id}
                  attribute={attr}
                  onEdit={() => setEditingAttribute(attr)}
                  onDelete={handleDeleteAttribute}
                />
              ))}
            </div>
          )
        ) : null}
      </section>

    </div>
  );
}
