// IndexedDB configuration
export const IDB_CONFIG = {
  DB_NAME: 'ClankerContextDB',
  DB_VERSION: 6,
  STORES: {
    SESSIONS: 'sessions',
    ISSUES: 'issues',
    NETWORK_ERRORS: 'network_errors',
    CONSOLE_ERRORS: 'console_errors',
    CONNECTIONS: 'connections',
    PROMPT_TEMPLATES: 'prompt_templates',
    CUSTOM_ATTRIBUTES: 'custom_attributes',
  },
} as const;

// Connection type metadata for UI
export const CONNECTION_TYPES = {
  opencode: {
    label: 'OpenCode',
    description: 'Local HTTP API for OpenCode',
    defaultEndpoint: 'http://localhost:4096',
  },
  vscode: {
    label: 'VSCode + Copilot',
    description: 'Send to GitHub Copilot Chat in Agent Mode',
    defaultEndpoint: 'http://localhost:41970',
  },
} as const;

// Default connections that come pre-installed
export const DEFAULT_CONNECTIONS = {
  opencode: {
    id: 'default_opencode',
    name: 'Default - OpenCode',
    type: 'opencode' as const,
    endpoint: CONNECTION_TYPES.opencode.defaultEndpoint,
    enabled: true,
    autoSend: true,
    isActive: true,
  },
  vscode: {
    id: 'default_vscode',
    name: 'Default - VSCode',
    type: 'vscode' as const,
    endpoint: CONNECTION_TYPES.vscode.defaultEndpoint,
    enabled: true,
    autoSend: false,
    isActive: false,
  },
} as const;

// DOM capture configuration
export const DOM_CAPTURE_CONFIG = {
  MAX_OUTER_HTML_LENGTH: 10000,
} as const;
