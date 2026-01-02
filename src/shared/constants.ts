// IndexedDB configuration
export const IDB_CONFIG = {
  DB_NAME: 'ClankerContextDB',
  DB_VERSION: 4,
  STORES: {
    SESSIONS: 'sessions',
    ISSUES: 'issues',
    NETWORK_ERRORS: 'network_errors',
    CONSOLE_ERRORS: 'console_errors',
    CONNECTIONS: 'connections',
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

// DOM capture configuration
export const DOM_CAPTURE_CONFIG = {
  MAX_OUTER_HTML_LENGTH: 10000,
} as const;
