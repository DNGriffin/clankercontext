// IndexedDB configuration
export const IDB_CONFIG = {
  DB_NAME: 'ClankerContextDB',
  DB_VERSION: 3,
  STORES: {
    SESSIONS: 'sessions',
    ISSUES: 'issues',
    NETWORK_ERRORS: 'network_errors',
    CONSOLE_ERRORS: 'console_errors',
  },
} as const;

// DOM capture configuration
export const DOM_CAPTURE_CONFIG = {
  MAX_OUTER_HTML_LENGTH: 10000,
} as const;
