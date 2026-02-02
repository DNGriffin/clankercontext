/**
 * ClankerContext Background Service Worker
 *
 * The main orchestrator for the extension. Manages:
 * - Session state machine
 * - CDP connection for console/network error capture
 * - Message routing between components
 * - Storage coordination
 */

import { storageManager } from './StorageManager';
import { sessionStateMachine } from './SessionStateMachine';
import { initMessageRouter, clearInjectionTracking } from './MessageRouter';
import { cdpController } from './CDPController';
import { iconController } from './IconController';

/**
 * Check if a URL is a restricted Chrome page that CDP cannot attach to.
 */
function isRestrictedUrl(url: string | undefined): boolean {
  if (!url) return true;
  return (
    url.startsWith('chrome://') ||
    url.startsWith('chrome-extension://') ||
    url.startsWith('devtools://')
  );
}

// Promise that resolves when initialization is complete
// Used by message handlers to wait for session rehydration
let initResolve: () => void;
export const initPromise = new Promise<void>((resolve) => {
  initResolve = resolve;
});

/**
 * Initialize the background service worker.
 */
async function init(): Promise<void> {
  // Initialize storage
  await storageManager.init();

  // Initialize default connections (idempotent - skips if already done)
  await storageManager.initializeDefaultConnections();

  // Try to rehydrate session state from storage (for service worker restart)
  const rehydrated = await sessionStateMachine.rehydrate();
  if (rehydrated) {
    const session = sessionStateMachine.getSession();

    // Check if paused
    const pausedResult = await chrome.storage.session.get('isPaused');
    const isPaused = pausedResult.isPaused === true;

    // If we have an active session and not paused, try to re-attach CDP
    if (session && sessionStateMachine.isMonitoring() && !isPaused) {
      try {
        // Verify tab still exists and isn't a restricted page
        const tab = await chrome.tabs.get(session.tabId);
        if (!tab || isRestrictedUrl(tab.url)) {
          // Use clearData=false to preserve issues across extension reloads
          await sessionStateMachine.forceReset(false);
          await iconController.showSleepIcon();
        } else {
          await cdpController.attach(session.tabId);
        }
      } catch {
        // Tab doesn't exist anymore, reset the session state but preserve issues
        await sessionStateMachine.forceReset(false);
        await iconController.showSleepIcon();
      }
    }

    // Restore icon state based on session state
    await iconController.restoreState(sessionStateMachine.isMonitoring(), isPaused);
  }

  // Initialize message routing
  initMessageRouter();

  // Handle external debugger detachment (e.g., user clicks "Cancel" on debugging banner)
  cdpController.setOnDetachCallback(async () => {
    // Pause listening on external detach
    await chrome.storage.session.set({ isPaused: true });
    await iconController.showSleepIcon();
  });

  // Signal that initialization is complete
  initResolve();
}

// Initialize on service worker start
init().catch(() => {
  // Failed to initialize
});

// Handle extension installation
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    // First installation - ensure default connections are created
    await storageManager.init();
    await storageManager.initializeDefaultConnections();
  }
});

// Handle tab switching - move session to new tab
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const session = sessionStateMachine.getSession();
  if (!session || !sessionStateMachine.isMonitoring()) {
    return;
  }

  // Skip if paused
  const pausedResult = await chrome.storage.session.get('isPaused');
  if (pausedResult.isPaused === true) {
    return;
  }

  // Skip if same tab
  if (session.tabId === activeInfo.tabId) {
    return;
  }

  try {
    // Detach CDP from old tab
    if (cdpController.isAttached()) {
      await cdpController.detach();
    }

    // Clear old error logs (keep issues)
    await storageManager.clearErrors(session.sessionId);

    // Switch session to new tab
    await sessionStateMachine.switchTab(activeInfo.tabId);

    // Clear content script injection tracking for new tab
    clearInjectionTracking(activeInfo.tabId);

    // Check if new tab is a restricted page before attaching CDP
    const tab = await chrome.tabs.get(activeInfo.tabId);
    if (isRestrictedUrl(tab.url)) {
      return;
    }

    // Attach CDP to new tab
    await cdpController.attach(activeInfo.tabId);
  } catch {
    // Failed to switch tab
  }
});

// Handle service worker activation
self.addEventListener('activate', () => {
  // Service worker activated
});
