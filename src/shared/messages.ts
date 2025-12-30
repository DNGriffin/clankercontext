import type { CapturedElement, Issue, IssueType, MonitoringSession } from './types';

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
  | { type: 'CLEAR_SESSION' };

// Background -> Popup responses
export interface StateResponse {
  session: MonitoringSession | null;
  issues: Issue[];
  errorCount: { network: number; console: number };
  isPaused: boolean;
}

export interface ExportResponse {
  success: boolean;
  markdown?: string;
  error?: string;
}

// Background -> Content messages
export type BackgroundToContentMessage =
  | { type: 'START_ELEMENT_PICKER'; issueType: IssueType }
  | { type: 'CANCEL_ELEMENT_PICKER' };

// Content -> Background messages
export type ContentToBackgroundMessage =
  | { type: 'ELEMENT_SELECTED'; elements: CapturedElement[]; pageUrl: string }
  | { type: 'ELEMENT_PICKER_CANCELLED' };
