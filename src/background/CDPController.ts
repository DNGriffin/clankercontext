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
  private operationInProgress: Promise<void> | null = null;
  private onDetachCallback: ((reason: string) => void) | null = null;

  /**
   * Set a callback to be notified when the debugger is detached externally
   * (e.g., user clicks "Cancel" on the Chrome debugging banner).
   */
  setOnDetachCallback(callback: (reason: string) => void): void {
    this.onDetachCallback = callback;
  }

  /**
   * Attach the debugger to a tab.
   * Uses a mutex to prevent concurrent attach/detach operations.
   */
  async attach(tabId: number): Promise<void> {
    // Wait for any pending operation to complete
    if (this.operationInProgress) {
      await this.operationInProgress;
    }

    this.operationInProgress = this.doAttach(tabId);
    try {
      await this.operationInProgress;
    } finally {
      this.operationInProgress = null;
    }
  }

  /**
   * Internal attach implementation.
   */
  private async doAttach(tabId: number): Promise<void> {
    // Clean up our internal state first (use doDetach to avoid mutex recursion)
    if (this.attachedTabId !== null) {
      await this.doDetach();
    }

    console.log('[CDP] Attaching to tab:', tabId);

    try {
      await chrome.debugger.attach({ tabId }, '1.3');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      // If already attached (by us from before service worker restart), try to detach and reattach
      if (errorMessage.includes('Another debugger is already attached')) {
        console.log('[CDP] Another debugger attached, attempting to take over...');
        try {
          await chrome.debugger.detach({ tabId });
          await new Promise((resolve) => setTimeout(resolve, 50));
          await chrome.debugger.attach({ tabId }, '1.3');
        } catch (retryError) {
          console.warn('[CDP] Failed to take over debugger:', retryError);
          throw retryError;
        }
      } else {
        console.warn('[CDP] Failed to attach:', error);
        throw error;
      }
    }

    this.attachedTabId = tabId;

    // Set up event listeners
    this.setupEventListeners();

    try {
      // Enable required domains
      await this.sendCommand('Network.enable', {});
      await this.sendCommand('Console.enable', {});
      await this.sendCommand('Runtime.enable', {});
      console.log('[CDP] Attached and enabled domains for tab:', tabId);
    } catch (error) {
      // If enabling domains fails, the attach might have silently failed
      console.warn('[CDP] Failed to enable domains:', error);
      this.attachedTabId = null;
      try {
        await chrome.debugger.detach({ tabId });
      } catch {
        // Ignore
      }
      throw error;
    }
  }

  /**
   * Detach the debugger from the current tab.
   * Uses a mutex to prevent concurrent attach/detach operations.
   */
  async detach(): Promise<void> {
    // Wait for any pending operation to complete
    if (this.operationInProgress) {
      await this.operationInProgress;
    }

    this.operationInProgress = this.doDetach();
    try {
      await this.operationInProgress;
    } finally {
      this.operationInProgress = null;
    }
  }

  /**
   * Internal detach implementation.
   */
  private async doDetach(): Promise<void> {
    if (this.attachedTabId === null) return;

    try {
      // Remove event listeners
      chrome.debugger.onEvent.removeListener(this.handleDebuggerEvent);
      chrome.debugger.onDetach.removeListener(this.handleDebuggerDetach);

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
   * Note: handleDebuggerEvent and handleDebuggerDetach are arrow functions,
   * so they already have correct `this` binding.
   * We use the same reference for add/remove to avoid memory leaks.
   */
  private setupEventListeners(): void {
    chrome.debugger.onEvent.addListener(this.handleDebuggerEvent);
    chrome.debugger.onDetach.addListener(this.handleDebuggerDetach);
  }

  /**
   * Handle external debugger detachment.
   * This fires when user clicks "Cancel" on the debugging banner,
   * when the tab is closed, or when DevTools takes over.
   */
  private handleDebuggerDetach = (
    source: chrome.debugger.Debuggee,
    reason: string
  ): void => {
    if (source.tabId !== this.attachedTabId) return;

    console.log('[CDP] Debugger detached externally, reason:', reason);

    // Clean up internal state
    this.attachedTabId = null;
    chrome.debugger.onEvent.removeListener(this.handleDebuggerEvent);
    chrome.debugger.onDetach.removeListener(this.handleDebuggerDetach);

    // Notify callback
    if (this.onDetachCallback) {
      this.onDetachCallback(reason);
    }
  };

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
   * Check if an error originates from a Chrome extension.
   */
  private isExtensionError(error: ConsoleError): boolean {
    const extensionPattern = /chrome-extension:\/\//;
    if (error.url && extensionPattern.test(error.url)) return true;
    if (error.stackTrace && extensionPattern.test(error.stackTrace)) return true;
    return false;
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

    // Skip errors originating from Chrome extensions
    if (this.isExtensionError(consoleError)) {
      return;
    }

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

    // Skip errors originating from Chrome extensions
    if (this.isExtensionError(consoleError)) {
      return;
    }

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
