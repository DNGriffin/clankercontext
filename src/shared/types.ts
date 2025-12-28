// Session States - simplified for new flow
export type SessionState = 'idle' | 'monitoring' | 'selecting_element';

// Issue Types
export type IssueType = 'enhancement' | 'fix';

// Issue - captured bug or enhancement request
export interface Issue {
  id: string;
  type: IssueType;
  timestamp: number;
  name: string;              // User-provided name for .md file
  userPrompt: string;        // User's description/request
  elementHTML: string;       // outerHTML of selected element
  elementSelector: string;   // CSS selector for reference
  pageUrl: string;
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
