import type { IssueType, MonitoringSession, SessionState } from '@/shared/types';
import { storageManager } from './StorageManager';

type StateTransition = {
  from: SessionState[];
  to: SessionState;
  action: string;
};

const VALID_TRANSITIONS: StateTransition[] = [
  { from: ['idle'], to: 'monitoring', action: 'startMonitoring' },
  { from: ['monitoring', 'selecting_element'], to: 'selecting_element', action: 'startElementSelection' },
  { from: ['selecting_element'], to: 'monitoring', action: 'finishElementSelection' },
];

export type SessionEventType =
  | 'stateChange'
  | 'sessionCreated'
  | 'sessionEnded'
  | 'error';

export interface SessionEvent {
  type: SessionEventType;
  state: SessionState;
  session: MonitoringSession | null;
  error?: Error;
}

type SessionEventListener = (event: SessionEvent) => void;

/**
 * State machine for managing monitoring session lifecycle.
 * Simplified for the new flow: idle -> monitoring -> selecting_element -> monitoring
 */
export class SessionStateMachine {
  private currentState: SessionState = 'idle';
  private currentSession: MonitoringSession | null = null;
  private listeners: Set<SessionEventListener> = new Set();

  /**
   * Get the current session.
   */
  getSession(): MonitoringSession | null {
    return this.currentSession;
  }

  /**
   * Check if a transition is valid.
   */
  private canTransition(action: string): boolean {
    return VALID_TRANSITIONS.some(
      (t) => t.action === action && t.from.includes(this.currentState)
    );
  }

  /**
   * Emit an event to all listeners.
   */
  private emit(event: SessionEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (error) {
        console.error('[SessionStateMachine] Listener error:', error);
      }
    }
  }

  /**
   * Subscribe to session events.
   */
  subscribe(listener: SessionEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Generate a unique session ID.
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Start monitoring a tab.
   */
  async startMonitoring(tabId: number): Promise<MonitoringSession> {
    if (!this.canTransition('startMonitoring')) {
      throw new Error(
        `Cannot start monitoring from state: ${this.currentState}`
      );
    }

    const session: MonitoringSession = {
      sessionId: this.generateSessionId(),
      startTime: Date.now(),
      tabId,
      state: 'monitoring',
    };

    this.currentSession = session;
    this.currentState = 'monitoring';

    // Persist session to storage
    await storageManager.saveSession(session);

    this.emit({
      type: 'sessionCreated',
      state: this.currentState,
      session: this.currentSession,
    });

    return session;
  }

  /**
   * Start element selection mode.
   */
  async startElementSelection(issueType: IssueType): Promise<void> {
    if (!this.canTransition('startElementSelection')) {
      throw new Error(
        `Cannot start element selection from state: ${this.currentState}`
      );
    }

    if (!this.currentSession) {
      throw new Error('No active session');
    }

    this.currentState = 'selecting_element';
    this.currentSession = {
      ...this.currentSession,
      state: 'selecting_element',
      pendingIssueType: issueType,
    };

    await storageManager.saveSession(this.currentSession);

    this.emit({
      type: 'stateChange',
      state: this.currentState,
      session: this.currentSession,
    });
  }

  /**
   * Finish element selection and return to monitoring.
   */
  async finishElementSelection(): Promise<void> {
    if (!this.canTransition('finishElementSelection')) {
      throw new Error(
        `Cannot finish element selection from state: ${this.currentState}`
      );
    }

    if (!this.currentSession) {
      throw new Error('No active session');
    }

    this.currentState = 'monitoring';
    this.currentSession = {
      ...this.currentSession,
      state: 'monitoring',
      pendingIssueType: undefined,
    };

    await storageManager.saveSession(this.currentSession);

    this.emit({
      type: 'stateChange',
      state: this.currentState,
      session: this.currentSession,
    });
  }

  /**
   * Force reset to idle state from any state.
   * Used for error recovery and cleanup scenarios.
   */
  async forceReset(clearData: boolean = true): Promise<void> {
    const previousSession = this.currentSession;

    this.currentState = 'idle';
    this.currentSession = null;

    if (previousSession) {
      if (clearData) {
        try {
          await storageManager.deleteSession(previousSession.sessionId);
        } catch (e) {
          console.error('[SessionStateMachine] Failed to clear session data:', e);
        }
      } else {
        try {
          await storageManager.saveSession({
            ...previousSession,
            state: 'idle',
            pendingIssueType: undefined,
          });
        } catch (e) {
          console.error('[SessionStateMachine] Failed to persist idle session:', e);
        }
      }
    }

    this.emit({
      type: 'stateChange',
      state: this.currentState,
      session: null,
    });
  }

  /**
   * Restore session state from storage (for service worker restart).
   */
  async rehydrate(): Promise<boolean> {
    try {
      const session = await storageManager.getActiveSession();
      if (session) {
        this.currentSession = session;
        this.currentState = session.state;
        console.log('[SessionStateMachine] Rehydrated session:', session.sessionId, 'state:', session.state);
        return true;
      }
    } catch (e) {
      console.error('[SessionStateMachine] Failed to rehydrate:', e);
    }
    return false;
  }

  /**
   * Resume a previous session (after extension reload).
   * Updates the session with a new tab ID and sets state to monitoring.
   */
  async resumeSession(session: MonitoringSession, newTabId: number): Promise<MonitoringSession> {
    const resumedSession: MonitoringSession = {
      ...session,
      tabId: newTabId,
      state: 'monitoring',
      pendingIssueType: undefined,
    };

    this.currentSession = resumedSession;
    this.currentState = 'monitoring';

    await storageManager.saveSession(resumedSession);

    this.emit({
      type: 'stateChange',
      state: this.currentState,
      session: this.currentSession,
    });

    console.log('[SessionStateMachine] Resumed session:', session.sessionId, 'on tab:', newTabId);
    return resumedSession;
  }

  /**
   * Check if currently monitoring.
   */
  isMonitoring(): boolean {
    return this.currentState === 'monitoring' || this.currentState === 'selecting_element';
  }

  /**
   * Switch session to a new tab.
   * Used when user switches tabs while session is active.
   */
  async switchTab(newTabId: number): Promise<void> {
    if (!this.currentSession) {
      return;
    }

    // Don't switch if we're in the middle of element selection
    if (this.currentState === 'selecting_element') {
      console.log('[SessionStateMachine] Ignoring tab switch during element selection');
      return;
    }

    console.log('[SessionStateMachine] Switching from tab', this.currentSession.tabId, 'to', newTabId);

    this.currentSession = {
      ...this.currentSession,
      tabId: newTabId,
    };

    await storageManager.saveSession(this.currentSession);

    this.emit({
      type: 'stateChange',
      state: this.currentState,
      session: this.currentSession,
    });
  }

  /**
   * Get the current tab ID.
   */
  getTabId(): number | null {
    return this.currentSession?.tabId ?? null;
  }
}

// Export singleton instance
export const sessionStateMachine = new SessionStateMachine();
