import type { ConsoleError, NetworkError } from '@/shared/types';
import { storageManager } from './StorageManager';
import { sessionStateMachine } from './SessionStateMachine';

type CDPMethod = string;
type CDPParams = Record<string, unknown>;

/**
 * Chrome DevTools Protocol Controller.
 * Simplified to only capture:
 * - Network errors (non-2XX responses and failed requests)
 * - Console errors and runtime exceptions
 */
class CDPController {
  private attachedTabId: number | null = null;

  /**
   * Attach the debugger to a tab.
   */
  async attach(tabId: number): Promise<void> {
    if (this.attachedTabId !== null) {
      await this.detach();
    }

    try {
      await chrome.debugger.attach({ tabId }, '1.3');
      this.attachedTabId = tabId;

      // Enable only required domains
      await this.sendCommand('Network.enable', {});
      await this.sendCommand('Console.enable', {});
      await this.sendCommand('Runtime.enable', {});

      // Set up event listeners
      this.setupEventListeners();

      console.log('[CDP] Attached to tab:', tabId);
    } catch (error) {
      console.error('[CDP] Failed to attach:', error);
      throw error;
    }
  }

  /**
   * Detach the debugger from the current tab.
   */
  async detach(): Promise<void> {
    if (this.attachedTabId === null) return;

    try {
      // Remove event listener
      chrome.debugger.onEvent.removeListener(this.handleDebuggerEvent);

      // Disable domains before detaching
      await this.sendCommand('Network.disable', {});
      await this.sendCommand('Console.disable', {});
      await this.sendCommand('Runtime.disable', {});

      await chrome.debugger.detach({ tabId: this.attachedTabId });
      console.log('[CDP] Detached from tab:', this.attachedTabId);
    } catch (error) {
      console.warn('[CDP] Error during detach:', error);
    } finally {
      this.attachedTabId = null;
    }
  }

  /**
   * Send a CDP command.
   */
  private async sendCommand(
    method: CDPMethod,
    params: CDPParams = {}
  ): Promise<unknown> {
    if (this.attachedTabId === null) {
      throw new Error('No tab attached');
    }

    return chrome.debugger.sendCommand(
      { tabId: this.attachedTabId },
      method,
      params
    );
  }

  /**
   * Set up CDP event listeners.
   */
  private setupEventListeners(): void {
    this.handleDebuggerEvent = this.handleDebuggerEvent.bind(this);
    chrome.debugger.onEvent.addListener(this.handleDebuggerEvent);
  }

  /**
   * Handle incoming debugger events.
   */
  private handleDebuggerEvent = (
    source: chrome.debugger.Debuggee,
    method: string,
    params?: unknown
  ): void => {
    if (source.tabId !== this.attachedTabId) return;

    const typedParams = params as CDPParams;

    switch (method) {
      // Network events - only capture non-2XX responses
      case 'Network.responseReceived':
        this.handleResponseReceived(typedParams);
        break;
      case 'Network.loadingFailed':
        this.handleLoadingFailed(typedParams);
        break;

      // Console events - only capture errors
      case 'Console.messageAdded':
        this.handleConsoleMessage(typedParams);
        break;

      // Runtime exceptions
      case 'Runtime.exceptionThrown':
        this.handleExceptionThrown(typedParams);
        break;
    }
  };

  /**
   * Handle Network.responseReceived event.
   * Only stores non-2XX responses.
   */
  private handleResponseReceived(params: CDPParams): void {
    const response = params.response as {
      url: string;
      status: number;
    };
    const type = params.type as string;

    // Only store non-2XX responses
    if (response.status >= 200 && response.status < 300) {
      return;
    }

    const session = sessionStateMachine.getSession();
    if (!session) return;

    const networkError: NetworkError = {
      timestamp: Date.now(),
      url: response.url,
      status: response.status,
      method: type === 'XHR' ? 'XHR' : 'GET', // Simplified method tracking
    };

    storageManager
      .addNetworkError(session.sessionId, networkError)
      .catch((err) => console.error('[CDP] Failed to store network error:', err));
  }

  /**
   * Handle Network.loadingFailed event.
   */
  private handleLoadingFailed(params: CDPParams): void {
    const errorText = params.errorText as string;

    const session = sessionStateMachine.getSession();
    if (!session) return;

    // For failed requests, we don't have URL info directly, so store what we can
    const networkError: NetworkError = {
      timestamp: Date.now(),
      url: `Request failed: ${errorText}`,
      status: 0, // 0 indicates network failure
      method: 'FAILED',
    };

    storageManager
      .addNetworkError(session.sessionId, networkError)
      .catch((err) => console.error('[CDP] Failed to store network error:', err));
  }

  /**
   * Handle Console.messageAdded event.
   * Only stores error-level messages.
   */
  private handleConsoleMessage(params: CDPParams): void {
    const message = params.message as {
      level: string;
      text: string;
      url?: string;
      line?: number;
    };

    // Only capture errors
    if (message.level !== 'error') {
      return;
    }

    const session = sessionStateMachine.getSession();
    if (!session) return;

    const consoleError: ConsoleError = {
      timestamp: Date.now(),
      message: message.text,
      url: message.url,
      lineNumber: message.line,
    };

    storageManager
      .addConsoleError(session.sessionId, consoleError)
      .catch((err) => console.error('[CDP] Failed to store console error:', err));
  }

  /**
   * Handle Runtime.exceptionThrown event.
   */
  private handleExceptionThrown(params: CDPParams): void {
    const exceptionDetails = params.exceptionDetails as {
      text: string;
      exception?: { description?: string };
      url?: string;
      lineNumber?: number;
      stackTrace?: { callFrames: Array<{ url: string; lineNumber: number }> };
    };

    const session = sessionStateMachine.getSession();
    if (!session) return;

    const message =
      exceptionDetails.exception?.description || exceptionDetails.text;
    const stackTrace = exceptionDetails.stackTrace?.callFrames
      .map((frame) => `${frame.url}:${frame.lineNumber}`)
      .join('\n');

    const consoleError: ConsoleError = {
      timestamp: Date.now(),
      message,
      stackTrace,
      url: exceptionDetails.url,
      lineNumber: exceptionDetails.lineNumber,
    };

    storageManager
      .addConsoleError(session.sessionId, consoleError)
      .catch((err) => console.error('[CDP] Failed to store exception:', err));
  }

  /**
   * Check if currently attached.
   */
  isAttached(): boolean {
    return this.attachedTabId !== null;
  }
}

// Export singleton instance
export const cdpController = new CDPController();
