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
  console.log('[ClankerContext] Initializing background service worker');

  // Initialize storage
  await storageManager.init();

  // Initialize default connections (idempotent - skips if already done)
  await storageManager.initializeDefaultConnections();

  // Try to rehydrate session state from storage (for service worker restart)
  const rehydrated = await sessionStateMachine.rehydrate();
  if (rehydrated) {
    const session = sessionStateMachine.getSession();
    console.log('[ClankerContext] Session rehydrated, state:', session?.state);

    // Check if paused
    const pausedResult = await chrome.storage.session.get('isPaused');
    const isPaused = pausedResult.isPaused === true;

    // If we have an active session and not paused, try to re-attach CDP
    if (session && sessionStateMachine.isMonitoring() && !isPaused) {
      try {
        // Verify tab still exists and isn't a restricted page
        const tab = await chrome.tabs.get(session.tabId);
        if (!tab || isRestrictedUrl(tab.url)) {
          console.warn('[ClankerContext] Stale or restricted tab, resetting session');
          await sessionStateMachine.forceReset(true);
          await iconController.showSleepIcon();
        } else {
          await cdpController.attach(session.tabId);
          console.log('[ClankerContext] CDP re-attached to tab:', session.tabId);
        }
      } catch (e) {
        console.warn('[ClankerContext] Tab no longer exists or failed to attach:', e);
        // Tab doesn't exist anymore, reset the session
        await sessionStateMachine.forceReset(true);
        await iconController.showSleepIcon();
      }
    } else if (isPaused) {
      console.log('[ClankerContext] Session is paused, not attaching CDP');
    }

    // Restore icon state based on session state
    await iconController.restoreState(sessionStateMachine.isMonitoring(), isPaused);
  }

  // Initialize message routing
  initMessageRouter();

  // Handle external debugger detachment (e.g., user clicks "Cancel" on debugging banner)
  cdpController.setOnDetachCallback(async (reason: string) => {
    console.log('[ClankerContext] CDP detached externally:', reason);

    // Pause listening on external detach
    await chrome.storage.session.set({ isPaused: true });
    await iconController.showSleepIcon();
  });

  // Subscribe to session events for logging
  sessionStateMachine.subscribe((event) => {
    console.log('[SessionStateMachine] Event:', event.type, event.state);
  });

  // Signal that initialization is complete
  initResolve();

  console.log('[ClankerContext] Background service worker initialized');
}

// Initialize on service worker start
init().catch((error) => {
  console.error('[ClankerContext] Failed to initialize:', error);
});

// Handle extension installation
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('[ClankerContext] Extension installed:', details.reason);

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

  console.log('[ClankerContext] Tab switched from', session.tabId, 'to', activeInfo.tabId);

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
      console.log('[ClankerContext] Skipping CDP attach for restricted page:', tab.url);
      return;
    }

    // Attach CDP to new tab
    await cdpController.attach(activeInfo.tabId);

    console.log('[ClankerContext] Session switched to tab:', activeInfo.tabId);
  } catch (e) {
    console.warn('[ClankerContext] Failed to switch tab:', e);
  }
});

// Handle service worker activation
self.addEventListener('activate', () => {
  console.log('[ClankerContext] Service worker activated');
});
