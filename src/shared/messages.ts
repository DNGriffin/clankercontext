import type { CapturedElement, Connection, CustomAttribute, Issue, IssueType, MonitoringSession, OpenCodeSession, VSCodeInstance } from './types';

// Popup -> Background messages
export type PopupToBackgroundMessage =
  | { type: 'GET_STATE' }
  | { type: 'START_LISTENING' }
  | { type: 'PAUSE_LISTENING' }
  | { type: 'RESUME_LISTENING' }
  | { type: 'START_ISSUE'; issueType: IssueType; userPrompt: string }
  | { type: 'EXPORT_ISSUE'; issueId: string; format: 'download' | 'clipboard' }
  | { type: 'EXPORT_ALL'; format: 'download' | 'clipboard' }
  | { type: 'DELETE_ISSUE'; issueId: string }
  | { type: 'MARK_ISSUE_EXPORTED'; issueId: string }
  | { type: 'CLEAR_SESSION' }
  | { type: 'GET_CONNECTIONS' }
  | { type: 'ADD_CONNECTION'; connection: Omit<Connection, 'id' | 'createdAt' | 'updatedAt'> }
  | { type: 'UPDATE_CONNECTION'; connection: Connection }
  | { type: 'DELETE_CONNECTION'; connectionId: string }
  | { type: 'TOGGLE_CONNECTION'; connectionId: string; enabled: boolean }
  | { type: 'SET_ACTIVE_CONNECTION'; connectionId: string }
  | { type: 'TEST_CONNECTION'; connectionId: string }
  | { type: 'GET_OPENCODE_SESSIONS'; connectionId: string }
  | { type: 'SEND_TO_OPENCODE'; connectionId: string; sessionId: string; issueId: string }
  | { type: 'GET_VSCODE_INSTANCES'; connectionId: string }
  | { type: 'SEND_TO_VSCODE'; connectionId: string; instanceId: string; issueId: string }
  | { type: 'GET_CUSTOM_ATTRIBUTES' }
  | { type: 'ADD_CUSTOM_ATTRIBUTE'; attribute: Omit<CustomAttribute, 'id' | 'createdAt' | 'updatedAt'> }
  | { type: 'UPDATE_CUSTOM_ATTRIBUTE'; attribute: CustomAttribute }
  | { type: 'DELETE_CUSTOM_ATTRIBUTE'; attributeId: string }
  | { type: 'QUICK_SELECT' };

// Background -> Popup responses
export interface StateResponse {
  session: MonitoringSession | null;
  issues: Issue[];
  isPaused: boolean;
  autoSendingIssueId?: string; // Issue currently being auto-sent
  autoSendingConnectionType?: 'opencode' | 'vscode'; // Type of connection for auto-send
  autoSendError?: boolean; // True if auto-send failed
}

export interface ExportResponse {
  success: boolean;
  markdown?: string;
  error?: string;
}

// Connections responses
export interface ConnectionsResponse {
  connections: Connection[];
}

export interface ConnectionMutationResponse {
  success: boolean;
  connection?: Connection;
  error?: string;
}

// OpenCode responses
export interface TestConnectionResponse {
  success: boolean;
  version?: string;
  error?: string;
}

export interface OpenCodeSessionsResponse {
  sessions: OpenCodeSession[];
  error?: string;
}

export interface SendToOpenCodeResponse {
  success: boolean;
  error?: string;
}

// VSCode responses
export interface VSCodeInstancesResponse {
  instances: VSCodeInstance[];
  error?: string;
}

export interface SendToVSCodeResponse {
  success: boolean;
  error?: string;
}

// Custom attributes responses
export interface CustomAttributesResponse {
  customAttributes: CustomAttribute[];
}

export interface CustomAttributeMutationResponse {
  success: boolean;
  customAttribute?: CustomAttribute;
  error?: string;
}

// Background -> Content messages
export type BackgroundToContentMessage =
  | { type: 'START_ELEMENT_PICKER'; issueType: IssueType; customAttributes?: CustomAttribute[]; quickSelect?: boolean }
  | { type: 'CANCEL_ELEMENT_PICKER' };

// Content -> Background messages
export type ContentToBackgroundMessage =
  | { type: 'ELEMENT_SELECTED'; elements: CapturedElement[]; pageUrl: string }
  | { type: 'ELEMENT_PICKER_CANCELLED' }
  | { type: 'QUICK_SELECT_COMPLETE'; elements: CapturedElement[]; pageUrl: string };
