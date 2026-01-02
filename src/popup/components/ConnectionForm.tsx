import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft } from 'lucide-react';
import type { Connection, ConnectionType } from '@/shared/types';
import { CONNECTION_TYPES } from '@/shared/constants';

interface ConnectionFormProps {
  connection: Connection | null;
  onSave: (
    data: Omit<Connection, 'id' | 'createdAt' | 'updatedAt'>
  ) => Promise<void>;
  onCancel: () => void;
}

export function ConnectionForm({
  connection,
  onSave,
  onCancel,
}: ConnectionFormProps): React.ReactElement {
  const [name, setName] = useState(connection?.name || 'Default - OpenCode');
  const [type, setType] = useState<ConnectionType>(
    connection?.type || 'opencode'
  );
  const [endpoint, setEndpoint] = useState(
    connection?.endpoint || CONNECTION_TYPES.opencode.defaultEndpoint
  );
  // Default autoSend to true for OpenCode, false for VSCode (since we can't track completion)
  const getDefaultAutoSend = (connectionType: ConnectionType) => connectionType === 'opencode';
  const [autoSend, setAutoSend] = useState(connection?.autoSend ?? getDefaultAutoSend(connection?.type || 'opencode'));
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      // For VSCode, use default endpoint (port scanning handles discovery)
      const finalEndpoint = type === 'vscode'
        ? CONNECTION_TYPES.vscode.defaultEndpoint
        : endpoint;
      // New connections are always enabled by default
      await onSave({ name, type, endpoint: finalEndpoint, enabled: true, autoSend });
    } finally {
      setSaving(false);
    }
  };

  const handleTypeChange = (newType: ConnectionType) => {
    setType(newType);
    if (!connection) {
      setEndpoint(CONNECTION_TYPES[newType].defaultEndpoint);
      // Update default name based on type
      setName(newType === 'vscode' ? 'Default - VSCode' : 'Default - OpenCode');
      // Update autoSend default based on type
      setAutoSend(getDefaultAutoSend(newType));
    }
  };

  return (
    <div className="flex flex-col p-3 min-h-[400px]">
      <div className="flex items-center gap-2 mb-4">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={onCancel}
          type="button"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h3 className="text-base font-semibold">
          {connection ? 'Edit Connection' : 'Add Connection'}
        </h3>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col flex-1">
        <label className="text-xs text-muted-foreground mb-1">Name</label>
        <input
          type="text"
          className="w-full p-2 border rounded-md text-sm mb-3 bg-background"
          placeholder="My OpenCode Instance"
          value={name}
          onChange={(e) => setName(e.target.value)}
          spellCheck={false}
          autoFocus
        />

        <label className="text-xs text-muted-foreground mb-1">Type</label>
        <select
          className="w-full p-2 border rounded-md text-sm mb-3 bg-background"
          value={type}
          onChange={(e) => handleTypeChange(e.target.value as ConnectionType)}
        >
          {Object.entries(CONNECTION_TYPES).map(([key, info]) => (
            <option key={key} value={key}>
              {info.label}
            </option>
          ))}
        </select>

        {type === 'opencode' && (
          <>
            <label className="text-xs text-muted-foreground mb-1">
              Endpoint URL
            </label>
            <input
              type="url"
              className="w-full p-2 border rounded-md text-sm mb-3 bg-background"
              placeholder="http://localhost:3000"
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
            />
          </>
        )}

        <div className="flex items-center gap-2 mb-4">
          <input
            type="checkbox"
            id="autoSend"
            checked={autoSend}
            onChange={(e) => setAutoSend(e.target.checked)}
            className="h-4 w-4"
          />
          <label htmlFor="autoSend" className="text-sm">
            Auto-send issues when logged
          </label>
        </div>

        <div className="flex gap-2 mt-auto">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={onCancel}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            size="sm"
            className="flex-1"
            disabled={!name.trim() || (type === 'opencode' && !endpoint.trim()) || saving}
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            {connection ? 'Save' : 'Add'}
          </Button>
        </div>
      </form>
    </div>
  );
}
