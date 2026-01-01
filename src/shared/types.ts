// Session States - simplified for new flow
export type SessionState = 'idle' | 'monitoring' | 'selecting_element';

// Issue Types
export type IssueType = 'enhancement' | 'fix';

// Captured element data
export interface CapturedElement {
  html: string;      // outerHTML of the element
  selector: string;  // CSS selector for reference
}

// Issue - captured bug or enhancement request
export interface Issue {
  id: string;
  type: IssueType;
  timestamp: number;
  name: string;              // User-provided name for .md file
  userPrompt: string;        // User's description/request
  elements: CapturedElement[]; // Array of selected elements
  pageUrl: string;
  exportedAt?: number;       // Timestamp when issue was exported/sent
}

// Network Error - only non-2XX responses
export interface NetworkError {
  timestamp: number;
  url: string;
  status: number;
  method: string;
}

// Console Error - only errors and exceptions
export interface ConsoleError {
  timestamp: number;
  message: string;
  stackTrace?: string;
  url?: string;
  lineNumber?: number;
}

// Monitoring Session
export interface MonitoringSession {
  sessionId: string;
  startTime: number;
  tabId: number;
  state: SessionState;
  pendingIssueType?: IssueType; // Set when user starts creating an issue
}

// Connection Types - extensible for future integrations
export type ConnectionType = 'opencode';

// Connection - represents a configured coding tool integration
export interface Connection {
  id: string;
  name: string;
  type: ConnectionType;
  endpoint: string;
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
  // Selected OpenCode session (for opencode type)
  selectedSessionId?: string;
  selectedSessionTitle?: string;
  // Auto-send issues to this connection (default: true)
  autoSend?: boolean;
}

// OpenCode session info (from OpenCode API)
export interface OpenCodeSession {
  id: string;
  title: string;
  directory: string;
  updatedAt: number;
}
